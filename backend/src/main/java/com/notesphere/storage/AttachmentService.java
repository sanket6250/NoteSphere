package com.notesphere.storage;

import com.notesphere.notes.NoteRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AttachmentService {
  private static final Pattern ATTACHMENT_ID = Pattern.compile(
    "(?i)/api/attachments/([0-9a-f-]{36})(?=[?/#\"'\\s]|$)"
  );
  private static final Set<String> INLINE_IMAGE_TYPES = Set.of(
    "image/avif", "image/bmp", "image/gif", "image/jpeg", "image/png", "image/webp"
  );

  private final AttachmentRepository attachments;
  private final NoteRepository notes;
  private final NamedParameterJdbcTemplate jdbc;
  private final long maxUploadBytes;

  public AttachmentService(
    AttachmentRepository attachments,
    NoteRepository notes,
    NamedParameterJdbcTemplate jdbc,
    @Value("${app.upload.max-size:25MB}") DataSize maxUploadSize
  ) {
    this.attachments = attachments;
    this.notes = notes;
    this.jdbc = jdbc;
    this.maxUploadBytes = maxUploadSize.toBytes();
  }

  @Transactional
  public AttachmentMetadata upload(UUID noteId, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty file");
    }
    if (file.getSize() > maxUploadBytes) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds the configured upload limit.");
    }
    requireNote(noteId);
    String name = sanitizeFileName(file.getOriginalFilename());
    String contentType = validateContentType(file.getContentType());
    try {
      StoredAttachment stored = attachments.saveAndFlush(new StoredAttachment(name, contentType, file.getBytes()));
      link(noteId, stored.getId());
      return metadata(stored);
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read the uploaded file.", exception);
    }
  }

  @Transactional
  public StoredAttachment storeImported(String fileName, String contentType, byte[] bytes) {
    if (bytes.length > maxUploadBytes) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "An imported attachment exceeds the configured upload limit.");
    }
    return attachments.saveAndFlush(
      new StoredAttachment(sanitizeFileName(fileName), validateContentType(contentType), bytes)
    );
  }

  @Transactional(readOnly = true)
  public List<AttachmentMetadata> listForNote(UUID noteId) {
    requireNote(noteId);
    return attachments.findMetadataByNoteId(noteId).stream().map(AttachmentService::metadata).toList();
  }

  @Transactional(readOnly = true)
  public AttachmentMetadata getMetadata(UUID id) {
    return attachments.findLinkedMetadata(id)
      .map(AttachmentService::metadata)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
  }

  @Transactional(readOnly = true)
  public byte[] read(UUID id) {
    AttachmentMetadata metadata = getMetadata(id);
    byte[] data = attachments.findFileData(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
    if (data.length != metadata.fileSize()) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Stored attachment data is incomplete.");
    }
    return data;
  }

  @Transactional
  public void delete(UUID noteId, UUID attachmentId) {
    MapSqlParameterSource parameters = new MapSqlParameterSource()
      .addValue("noteId", noteId)
      .addValue("attachmentId", attachmentId);
    int deleted = jdbc.update(
      "DELETE FROM note_attachments WHERE note_id = :noteId AND attachment_id = :attachmentId",
      parameters
    );
    if (deleted == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found for this note");
    }
    deleteOrphans(List.of(attachmentId));
  }

  @Transactional
  public void syncNoteAttachments(UUID noteId, String html) {
    requireNote(noteId);
    Set<UUID> mentionedIds = attachmentIds(html);
    Set<UUID> linkedIds = new HashSet<>(jdbc.query(
      "SELECT attachment_id FROM note_attachments WHERE note_id = :noteId",
      new MapSqlParameterSource("noteId", noteId),
      (result, row) -> result.getObject(1, UUID.class)
    ));

    Set<UUID> removed = new HashSet<>(linkedIds);
    removed.removeAll(mentionedIds);
    if (!removed.isEmpty()) {
      jdbc.update(
        "DELETE FROM note_attachments WHERE note_id = :noteId AND attachment_id IN (:attachmentIds)",
        new MapSqlParameterSource().addValue("noteId", noteId).addValue("attachmentIds", removed)
      );
      deleteOrphans(List.copyOf(removed));
    }

    for (UUID id : mentionedIds) {
      if (attachments.existsById(id)) link(noteId, id);
    }
  }

  @Transactional
  public void deleteFilesForNotes(List<UUID> noteIds) {
    if (noteIds.isEmpty()) return;
    List<UUID> linkedIds = attachments.findAttachmentIdsByNoteIds(noteIds).stream().distinct().toList();
    jdbc.update(
      "DELETE FROM note_attachments WHERE note_id IN (:noteIds)",
      new MapSqlParameterSource("noteIds", noteIds)
    );
    deleteOrphans(linkedIds);
  }

  private void deleteOrphans(List<UUID> attachmentIds) {
    if (attachmentIds.isEmpty()) return;
    jdbc.update("""
      DELETE FROM attachments a
      WHERE a.id IN (:attachmentIds)
        AND NOT EXISTS (
          SELECT 1 FROM note_attachments na WHERE na.attachment_id = a.id
        )
      """, new MapSqlParameterSource("attachmentIds", attachmentIds));
  }

  private void link(UUID noteId, UUID attachmentId) {
    jdbc.update("""
      INSERT INTO note_attachments(note_id, attachment_id)
      VALUES (:noteId, :attachmentId)
      ON CONFLICT DO NOTHING
      """, new MapSqlParameterSource().addValue("noteId", noteId).addValue("attachmentId", attachmentId));
  }

  private void requireNote(UUID noteId) {
    if (noteId == null || !notes.existsById(noteId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found");
    }
  }

  private static Set<UUID> attachmentIds(String html) {
    Set<UUID> ids = new HashSet<>();
    Matcher matcher = ATTACHMENT_ID.matcher(html == null ? "" : html);
    while (matcher.find()) {
      try {
        ids.add(UUID.fromString(matcher.group(1)));
      } catch (IllegalArgumentException ignored) {
        // A malformed URL is not an attachment reference.
      }
    }
    return ids;
  }

  private static String sanitizeFileName(String rawName) {
    String name = rawName == null || rawName.isBlank() ? "attachment" : rawName;
    name = name.replaceAll("[\\\\/\\p{Cntrl}\"]", "_").trim();
    if (name.isBlank() || name.equals(".") || name.equals("..")) name = "attachment";
    if (name.length() > 255) name = name.substring(0, 255);
    return name;
  }

  private static String validateContentType(String rawType) {
    if (rawType == null || rawType.isBlank()) return "application/octet-stream";
    if (rawType.length() > 255) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid content type");
    }
    try {
      org.springframework.http.MediaType.parseMediaType(rawType);
      return rawType;
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid content type", exception);
    }
  }

  private static AttachmentMetadata metadata(StoredAttachment attachment) {
    return new AttachmentMetadata(
      attachment.getId(),
      attachment.getFileName(),
      attachment.getOriginalFileName(),
      attachment.getContentType(),
      attachment.getFileSize(),
      attachment.getFileExtension(),
      attachment.getCreatedAt(),
      attachment.getUpdatedAt()
    );
  }

  private static AttachmentMetadata metadata(AttachmentRepository.AttachmentMetadataView view) {
    return new AttachmentMetadata(
      view.getId(),
      view.getFileName(),
      view.getOriginalFileName(),
      view.getContentType(),
      view.getFileSize(),
      view.getFileExtension(),
      view.getCreatedAt(),
      view.getUpdatedAt()
    );
  }

  public static boolean canRenderInline(String contentType) {
    String normalized = contentType.toLowerCase(Locale.ROOT);
    return INLINE_IMAGE_TYPES.contains(normalized) || normalized.equals("application/pdf");
  }
}
