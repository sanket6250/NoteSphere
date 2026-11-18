package com.notesphere.notes;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FolderArchiveService {
  private static final int MAX_ARCHIVE_ENTRIES = 25_000;
  private static final int MAX_FOLDERS = 10_000;
  private static final int MAX_NOTES = 20_000;
  private static final int MAX_ATTACHMENTS = 5_000;
  private static final Pattern ATTACHMENT_URL = Pattern.compile(
    "(?i)(?:https?://[^\\s\"'<>]*?)?/api/attachments/([0-9a-f-]{36})\\?key=([^&\\s\"'<>]+)"
      + "(?:&(?:amp;)?fileName=[^&\\s\"'<>]+)?(?:&(?:amp;)?inline=(true|false))?"
  );
  private static final Set<String> NOTE_TYPES = Set.of(
    "blank", "meeting", "journal", "todo", "project", "study", "technical", "quick"
  );

  private final FolderRepository folders;
  private final NoteRepository notes;
  private final MinioClient storage;
  private final ObjectMapper objectMapper;
  private final String bucket;
  private final long maxArchiveBytes;

  public FolderArchiveService(
    FolderRepository folders,
    NoteRepository notes,
    MinioClient storage,
    ObjectMapper objectMapper,
    @Value("${app.s3.bucket}") String bucket,
    @Value("${app.archive.max-size:260MB}") org.springframework.util.unit.DataSize maxArchiveSize
  ) {
    this.folders = folders;
    this.notes = notes;
    this.storage = storage;
    this.objectMapper = objectMapper;
    this.bucket = bucket;
    this.maxArchiveBytes = maxArchiveSize.toBytes();
  }

  @Transactional(readOnly = true)
  public FolderArchiveExport prepareExport(UUID rootFolderId) {
    Folder root = folders.findById(rootFolderId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
    Map<UUID, Folder> allFolders = new LinkedHashMap<>();
    folders.findAllByOrderByNameAsc().forEach(folder -> allFolders.put(folder.getId(), folder));
    Set<UUID> subtreeIds = collectSubtree(rootFolderId, allFolders);
    List<Folder> subtree = subtreeIds.stream().map(allFolders::get)
      .sorted(Comparator.comparingInt(folder -> folderDepth(folder, allFolders)))
      .toList();

    List<ArchiveFolder> archiveFolders = subtree.stream()
      .map(folder -> new ArchiveFolder(
        folder.getId(),
        folder.getId().equals(rootFolderId) ? null : folder.getParentFolderId(),
        folder.getName(),
        folder.getCreatedAt(),
        folder.getUpdatedAt()
      ))
      .toList();
    List<ArchiveNote> archiveNotes = notes.findAllByOrderByUpdatedAtDesc().stream()
      .filter(note -> note.getFolderId() != null && subtreeIds.contains(note.getFolderId()))
      .map(note -> new ArchiveNote(
        note.getId(),
        note.getFolderId(),
        note.getTitle(),
        note.getContent(),
        note.getNoteType(),
        note.isFavorite(),
        note.isPinned(),
        note.isArchived(),
        note.getCreatedAt(),
        note.getUpdatedAt()
      ))
      .toList();
    List<ArchiveAttachment> attachments = collectAttachments(archiveNotes);

    ArchiveManifest manifest = new ArchiveManifest(
      1,
      rootFolderId,
      archiveFolders,
      archiveNotes,
      attachments
    );
    if (archiveFolders.size() > MAX_FOLDERS || archiveNotes.size() > MAX_NOTES
      || attachments.size() > MAX_ATTACHMENTS) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "This folder contains too many items to export.");
    }
    try {
      long uncompressedSize = objectMapper.writeValueAsBytes(manifest).length
        + attachments.stream().mapToLong(ArchiveAttachment::size).sum();
      if (uncompressedSize > maxArchiveBytes) {
        throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "This folder backup exceeds the configured archive size limit.");
      }
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not prepare the folder backup manifest.", exception);
    }
    return new FolderArchiveExport(manifest, attachments);
  }

  @Transactional(readOnly = true)
  public FolderArchiveExport prepareNoteExport(UUID noteId) {
    Note note = notes.findById(noteId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
    UUID archiveFolderId = note.getFolderId() == null ? UUID.randomUUID() : note.getFolderId();
    Folder folder = note.getFolderId() == null ? null : folders.findById(note.getFolderId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note folder not found"));
    Instant createdAt = folder == null ? note.getCreatedAt() : folder.getCreatedAt();
    Instant updatedAt = folder == null ? note.getUpdatedAt() : folder.getUpdatedAt();
    ArchiveFolder archiveFolder = new ArchiveFolder(
      archiveFolderId,
      null,
      folder == null ? "Unfiled note" : folder.getName(),
      createdAt,
      updatedAt
    );
    ArchiveNote archiveNote = new ArchiveNote(
      note.getId(),
      archiveFolderId,
      note.getTitle(),
      note.getContent(),
      note.getNoteType(),
      note.isFavorite(),
      note.isPinned(),
      note.isArchived(),
      note.getCreatedAt(),
      note.getUpdatedAt()
    );
    List<ArchiveAttachment> attachments = collectAttachments(List.of(archiveNote));
    if (attachments.size() > MAX_ATTACHMENTS) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "This note has too many attachments to export.");
    }
    ArchiveManifest manifest = new ArchiveManifest(
      1,
      archiveFolderId,
      List.of(archiveFolder),
      List.of(archiveNote),
      attachments
    );
    try {
      long uncompressedSize = objectMapper.writeValueAsBytes(manifest).length
        + attachments.stream().mapToLong(ArchiveAttachment::size).sum();
      if (uncompressedSize > maxArchiveBytes) {
        throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "This note backup exceeds the configured archive size limit.");
      }
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not prepare the note backup manifest.", exception);
    }
    return new FolderArchiveExport(manifest, attachments);
  }

  public void writeExport(FolderArchiveExport archive, OutputStream output) throws IOException {
    try (ZipOutputStream zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
      zip.putNextEntry(new ZipEntry("manifest.json"));
      zip.write(objectMapper.writeValueAsBytes(archive.manifest()));
      zip.closeEntry();

      for (ArchiveAttachment attachment : archive.attachments()) {
        zip.putNextEntry(new ZipEntry(attachment.archivePath()));
        try (InputStream input = storage.getObject(GetObjectArgs.builder()
          .bucket(bucket)
          .object(attachment.objectKey())
          .build())) {
          input.transferTo(zip);
        } catch (Exception exception) {
          throw new IOException("Could not export attachment " + attachment.fileName(), exception);
        }
        zip.closeEntry();
      }
      zip.finish();
    }
  }

  public ArchivePreview preview(MultipartFile file) {
    ParsedArchive archive = parse(file);
    ArchiveManifest manifest = archive.manifest();
    Map<UUID, ArchiveFolder> foldersById = indexFolders(manifest);
    List<String> folderPaths = folderPaths(manifest, foldersById);
    List<PreviewNote> notePreview = manifest.notes().stream()
      .limit(40)
      .map(note -> new PreviewNote(
        note.title(),
        pathFor(note.folderId(), foldersById),
        note.noteType(),
        note.favorite(),
        note.pinned(),
        note.archived()
      ))
      .toList();
    List<String> warnings = manifest.notes().size() > notePreview.size()
      ? List.of("Showing the first 40 notes in the preview; all notes will be imported.")
      : List.of();
    ArchiveFolder root = manifest.folders().stream()
      .filter(folder -> folder.id().equals(manifest.rootFolderId()))
      .findFirst()
      .orElseThrow();
    Folder conflict = findRootFolder(root.name());
    return new ArchivePreview(
      manifest.folders().size(),
      manifest.notes().size(),
      manifest.attachments().size(),
      root.name(),
      folderPaths,
      notePreview,
      warnings,
      conflict == null ? null : conflict.getId(),
      conflict == null ? null : conflict.getName()
    );
  }

  public NoteArchivePreview previewNote(MultipartFile file) {
    ArchiveManifest manifest = parse(file).manifest();
    ArchiveNote source = requireSingleNote(manifest);
    Folder destination = folders.findById(source.folderId()).orElse(null);
    Note duplicate = findDuplicateNote(source, destination == null ? null : destination.getId());
    return new NoteArchivePreview(
      source.title(),
      source.noteType(),
      manifest.attachments().size(),
      source.favorite(),
      source.pinned(),
      source.archived(),
      duplicate == null ? null : duplicate.getId(),
      duplicate == null ? null : duplicate.getTitle()
    );
  }

  @Transactional
  public ArchiveImportResult importArchive(MultipartFile file, ImportStrategy strategy) {
    ParsedArchive archive = parse(file);
    ArchiveManifest manifest = archive.manifest();
    ArchiveFolder sourceRoot = manifest.folders().stream()
      .filter(folder -> folder.id().equals(manifest.rootFolderId()))
      .findFirst()
      .orElseThrow();
    Folder existingRoot = findRootFolder(sourceRoot.name());
    if (strategy == ImportStrategy.OVERRIDE && existingRoot == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "The folder to override no longer exists. Preview the archive again.");
    }
    List<UploadedObject> uploadedObjects = new ArrayList<>();
    try {
      Map<String, AttachmentReference> importedAttachments = uploadAttachments(archive, manifest, uploadedObjects);
      if (strategy == ImportStrategy.OVERRIDE) clearFolderContents(existingRoot);
      Map<UUID, Folder> importedFolders = createFolders(
        manifest,
        strategy == ImportStrategy.OVERRIDE ? existingRoot : null
      );
      List<Note> importedNotes = createNotes(manifest, importedFolders, importedAttachments);
      Folder root = importedFolders.get(manifest.rootFolderId());
      return new ArchiveImportResult(
        root.getId(),
        root.getName(),
        importedFolders.size(),
        importedNotes.size(),
        uploadedObjects.size()
      );
    } catch (RuntimeException exception) {
      removeUploadedObjects(uploadedObjects, exception);
      throw exception;
    }
  }

  @Transactional
  public NoteImportResult importNote(MultipartFile file, ImportStrategy strategy) {
    ParsedArchive archive = parse(file);
    ArchiveManifest manifest = archive.manifest();
    ArchiveNote source = requireSingleNote(manifest);
    Folder destination = folders.findById(source.folderId()).orElse(null);
    Note duplicate = findDuplicateNote(source, destination == null ? null : destination.getId());
    if (strategy == ImportStrategy.OVERRIDE && duplicate == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "The note to override no longer exists. Preview the archive again.");
    }

    List<UploadedObject> uploadedObjects = new ArrayList<>();
    try {
      Map<String, AttachmentReference> importedAttachments = uploadAttachments(archive, manifest, uploadedObjects);
      Note target = strategy == ImportStrategy.OVERRIDE ? duplicate : new Note();
      String title = strategy == ImportStrategy.COPY && duplicate != null
        ? uniqueNoteTitle(source.title(), destination == null ? null : destination.getId())
        : source.title();
      target.setTitle(title);
      target.setContent(rewriteAttachmentUrls(source.content(), importedAttachments));
      target.setFolder(destination);
      target.setNoteType(source.noteType());
      target.setFavorite(source.favorite());
      target.setPinned(source.pinned());
      target.setArchived(source.archived());
      target.restoreTimestamps(source.createdAt(), source.updatedAt());
      Note saved = notes.save(target);
      return new NoteImportResult(saved.getId(), saved.getTitle(), duplicate != null && strategy == ImportStrategy.OVERRIDE, uploadedObjects.size());
    } catch (RuntimeException exception) {
      removeUploadedObjects(uploadedObjects, exception);
      throw exception;
    }
  }

  private List<ArchiveAttachment> collectAttachments(List<ArchiveNote> archiveNotes) {
    Map<String, ArchiveAttachment> attachments = new LinkedHashMap<>();
    for (ArchiveNote note : archiveNotes) {
      for (AttachmentReference reference : attachmentReferences(note.content())) {
        String identity = attachmentIdentity(reference.id(), reference.objectKey());
        if (attachments.containsKey(identity)) continue;
        try {
          StatObjectResponse metadata = storage.statObject(StatObjectArgs.builder()
            .bucket(bucket)
            .object(reference.objectKey())
            .build());
          String name = fileName(reference.objectKey());
          attachments.put(identity, new ArchiveAttachment(
            reference.id(),
            reference.objectKey(),
            "attachments/" + reference.id() + "/" + name,
            name,
            metadata.contentType() == null || metadata.contentType().isBlank()
              ? MediaType.APPLICATION_OCTET_STREAM_VALUE
              : metadata.contentType(),
            metadata.size()
          ));
        } catch (Exception exception) {
          throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY,
            "Could not read attachment " + fileName(reference.objectKey()) + " for export",
            exception
          );
        }
      }
    }
    return List.copyOf(attachments.values());
  }

  private ArchiveNote requireSingleNote(ArchiveManifest manifest) {
    if (manifest.notes().size() != 1 || manifest.folders().size() != 1
      || !manifest.notes().getFirst().folderId().equals(manifest.rootFolderId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note backup must contain exactly one note and its export folder.");
    }
    return manifest.notes().getFirst();
  }

  private Note findDuplicateNote(ArchiveNote source, UUID destinationFolderId) {
    Note sameId = notes.findById(source.id()).orElse(null);
    if (sameId != null) return sameId;
    return notes.findAllByOrderByUpdatedAtDesc().stream()
      .filter(note -> note.getTitle().equalsIgnoreCase(source.title()))
      .filter(note -> java.util.Objects.equals(note.getFolderId(), destinationFolderId))
      .findFirst()
      .orElse(null);
  }

  private String uniqueNoteTitle(String sourceTitle, UUID folderId) {
    Set<String> used = new HashSet<>();
    notes.findAllByOrderByUpdatedAtDesc().stream()
      .filter(note -> java.util.Objects.equals(note.getFolderId(), folderId))
      .map(note -> note.getTitle().toLowerCase(Locale.ROOT))
      .forEach(used::add);
    String base = sourceTitle.trim();
    String candidate = base;
    int suffix = 1;
    while (!used.add(candidate.toLowerCase(Locale.ROOT))) {
      suffix++;
      String ending = " (imported" + (suffix == 2 ? "" : " " + suffix) + ")";
      int maxBaseLength = 300 - ending.length();
      candidate = base.substring(0, Math.min(base.length(), maxBaseLength)).trim() + ending;
    }
    return candidate;
  }

  private Folder findRootFolder(String name) {
    return folders.findAllByOrderByNameAsc().stream()
      .filter(folder -> folder.getParentFolderId() == null)
      .filter(folder -> normalizedName(folder.getName()).equals(normalizedName(name)))
      .findFirst()
      .orElse(null);
  }

  private void clearFolderContents(Folder root) {
    Map<UUID, Folder> allFolders = new LinkedHashMap<>();
    folders.findAllByOrderByNameAsc().forEach(folder -> allFolders.put(folder.getId(), folder));
    Set<UUID> subtreeIds = collectSubtree(root.getId(), allFolders);
    List<Note> notesToDelete = notes.findAllByOrderByUpdatedAtDesc().stream()
      .filter(note -> subtreeIds.contains(note.getFolderId()))
      .toList();
    notes.deleteAll(notesToDelete);
    List<Folder> descendants = subtreeIds.stream()
      .filter(id -> !id.equals(root.getId()))
      .map(allFolders::get)
      .sorted(Comparator.comparingInt((Folder folder) -> folderDepth(folder, allFolders)).reversed())
      .toList();
    folders.deleteAll(descendants);
  }

  private ParsedArchive parse(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a ZIP archive to import.");
    }
    if (file.getSize() > maxArchiveBytes) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The ZIP archive exceeds the configured import limit.");
    }

    Map<String, byte[]> entries = new LinkedHashMap<>();
    long expandedBytes = 0;
    int entryCount = 0;
    try (ZipInputStream zip = new ZipInputStream(file.getInputStream(), StandardCharsets.UTF_8)) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        if (++entryCount > MAX_ARCHIVE_ENTRIES) {
          throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The archive contains too many entries.");
        }
        if (entry.isDirectory()) continue;
        String path = validateArchivePath(entry.getName());
        if (entries.containsKey(path)) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive contains duplicate paths.");
        }
        ByteArrayOutputStream content = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = zip.read(buffer)) != -1) {
          expandedBytes += read;
          if (expandedBytes > maxArchiveBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The expanded archive exceeds the configured import limit.");
          }
          content.write(buffer, 0, read);
        }
        entries.put(path, content.toByteArray());
        zip.closeEntry();
      }
    } catch (ResponseStatusException exception) {
      throw exception;
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file is not a readable ZIP archive.", exception);
    }

    byte[] manifestContent = entries.get("manifest.json");
    if (manifestContent == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive is missing manifest.json.");
    }
    ArchiveManifest manifest;
    try {
      manifest = objectMapper.readValue(manifestContent, ArchiveManifest.class);
    } catch (IOException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive manifest is invalid JSON.", exception);
    }
    validateManifest(manifest, entries);
    return new ParsedArchive(manifest, entries);
  }

  private void validateManifest(ArchiveManifest manifest, Map<String, byte[]> entries) {
    if (manifest == null || manifest.formatVersion() != 1
      || manifest.rootFolderId() == null
      || manifest.folders() == null || manifest.folders().isEmpty()
      || manifest.notes() == null || manifest.attachments() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive manifest is missing required data or uses an unsupported version.");
    }
    if (manifest.folders().size() > MAX_FOLDERS
      || manifest.notes().size() > MAX_NOTES
      || manifest.attachments().size() > MAX_ATTACHMENTS) {
      throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The archive contains too many folders, notes, or attachments.");
    }

    Map<UUID, ArchiveFolder> foldersById = new LinkedHashMap<>();
    for (ArchiveFolder folder : manifest.folders()) {
      if (folder == null || folder.id() == null || foldersById.put(folder.id(), folder) != null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folder IDs in the archive must be present and unique.");
      }
      validateFolderName(folder.name());
    }
    ArchiveFolder root = foldersById.get(manifest.rootFolderId());
    if (root == null || root.parentFolderId() != null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive root folder is invalid.");
    }
    for (ArchiveFolder folder : manifest.folders()) {
      if (folder.parentFolderId() != null && !foldersById.containsKey(folder.parentFolderId())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A folder references a missing parent.");
      }
      Set<UUID> visited = new HashSet<>();
      ArchiveFolder ancestor = folder;
      while (ancestor != null) {
        if (!visited.add(ancestor.id())) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive contains a folder cycle.");
        }
        ancestor = ancestor.parentFolderId() == null ? null : foldersById.get(ancestor.parentFolderId());
      }
    }

    for (ArchiveNote note : manifest.notes()) {
      if (note == null || note.id() == null || note.title() == null || note.title().isBlank()
        || note.title().length() > 300 || note.content() == null || note.noteType() == null
        || !NOTE_TYPES.contains(note.noteType())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note in the archive has invalid required metadata.");
      }
      if (!foldersById.containsKey(note.folderId())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note references a folder that is not in this archive.");
      }
    }

    Map<String, ArchiveAttachment> attachmentsByIdentity = new HashMap<>();
    Set<String> paths = new HashSet<>();
    for (ArchiveAttachment attachment : manifest.attachments()) {
      if (attachment == null || attachment.id() == null || attachment.objectKey() == null
        || attachment.archivePath() == null || attachment.fileName() == null
        || attachment.fileName().length() > 255 || attachment.objectKey().length() > 1024
        || attachment.contentType() == null || attachment.contentType().length() > 255
        || attachment.size() < 0 || attachment.size() > 25L * 1024 * 1024) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An attachment entry in the manifest is invalid.");
      }
      try {
        MediaType.parseMediaType(attachment.contentType());
      } catch (IllegalArgumentException exception) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An attachment content type in the manifest is invalid.", exception);
      }
      UUID id;
      try {
        id = UUID.fromString(attachment.id());
      } catch (IllegalArgumentException exception) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An attachment ID in the manifest is invalid.", exception);
      }
      if (!attachment.objectKey().startsWith(id + "/")
        || !safeObjectKey(attachment.objectKey())
        || !attachmentPathMatches(attachment)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An attachment object key or archive path is invalid.");
      }
      if (!entries.containsKey(attachment.archivePath())
        || entries.get(attachment.archivePath()).length != attachment.size()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An attachment is missing or has an invalid size.");
      }
      if (!paths.add(attachment.archivePath())
        || attachmentsByIdentity.put(attachmentIdentity(attachment.id(), attachment.objectKey()), attachment) != null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment paths and references must be unique.");
      }
    }
    for (ArchiveNote note : manifest.notes()) {
      for (AttachmentReference reference : attachmentReferences(note.content())) {
        if (!attachmentsByIdentity.containsKey(attachmentIdentity(reference.id(), reference.objectKey()))) {
          throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "A note references an attachment that is missing from the archive."
          );
        }
      }
    }
  }

  private Map<String, AttachmentReference> uploadAttachments(
    ParsedArchive archive,
    ArchiveManifest manifest,
    List<UploadedObject> uploadedObjects
  ) {
    Map<String, AttachmentReference> imported = new HashMap<>();
    for (ArchiveAttachment attachment : manifest.attachments()) {
      String newId = UUID.randomUUID().toString();
      String newKey = newId + "/" + fileName(attachment.fileName());
      byte[] content = archive.entries().get(attachment.archivePath());
      try {
        storage.putObject(PutObjectArgs.builder()
          .bucket(bucket)
          .object(newKey)
          .stream(new java.io.ByteArrayInputStream(content), content.length, -1)
          .contentType(attachment.contentType())
          .build());
      } catch (Exception exception) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not restore attachment " + attachment.fileName(), exception);
      }
      uploadedObjects.add(new UploadedObject(newId, newKey));
      imported.put(
        attachmentIdentity(attachment.id(), attachment.objectKey()),
        new AttachmentReference(newId, newKey, attachment.fileName())
      );
    }
    return imported;
  }

  private Map<UUID, Folder> createFolders(ArchiveManifest manifest, Folder overrideRoot) {
    Map<UUID, ArchiveFolder> sourceFolders = new LinkedHashMap<>();
    manifest.folders().forEach(folder -> sourceFolders.put(folder.id(), folder));
    Map<UUID, Folder> created = new HashMap<>();
    Map<UUID, Set<String>> usedNamesByParent = new HashMap<>();
    folders.findAllByOrderByNameAsc().forEach(folder ->
      usedNamesByParent.computeIfAbsent(folder.getParentFolderId(), ignored -> new HashSet<>())
        .add(normalizedName(folder.getName()))
    );

    List<ArchiveFolder> ordered = manifest.folders().stream()
      .sorted(Comparator.comparingInt(folder -> archiveFolderDepth(folder, sourceFolders)))
      .toList();
    for (ArchiveFolder source : ordered) {
      if (overrideRoot != null && source.id().equals(manifest.rootFolderId())) {
        created.put(source.id(), overrideRoot);
        continue;
      }
      Folder parent = source.parentFolderId() == null ? null : created.get(source.parentFolderId());
      UUID parentId = parent == null ? null : parent.getId();
      Set<String> usedNames = usedNamesByParent.computeIfAbsent(parentId, ignored -> new HashSet<>());
      String name = uniqueFolderName(source.name(), usedNames);
      Folder folder = new Folder(name, parent);
      folder.restoreTimestamps(source.createdAt(), source.updatedAt());
      created.put(source.id(), folders.save(folder));
    }
    return created;
  }

  private List<Note> createNotes(
    ArchiveManifest manifest,
    Map<UUID, Folder> importedFolders,
    Map<String, AttachmentReference> importedAttachments
  ) {
    List<Note> imported = new ArrayList<>();
    for (ArchiveNote source : manifest.notes()) {
      Note note = new Note();
      note.setTitle(source.title());
      note.setContent(rewriteAttachmentUrls(source.content(), importedAttachments));
      note.setFolder(importedFolders.get(source.folderId()));
      note.setNoteType(source.noteType());
      note.setFavorite(source.favorite());
      note.setPinned(source.pinned());
      note.setArchived(source.archived());
      note.restoreTimestamps(source.createdAt(), source.updatedAt());
      imported.add(notes.save(note));
    }
    return imported;
  }

  private void removeUploadedObjects(List<UploadedObject> uploadedObjects, RuntimeException original) {
    for (UploadedObject uploaded : uploadedObjects) {
      try {
        storage.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(uploaded.objectKey()).build());
      } catch (Exception cleanupException) {
        original.addSuppressed(cleanupException);
      }
    }
  }

  private List<String> folderPaths(ArchiveManifest manifest, Map<UUID, ArchiveFolder> foldersById) {
    return manifest.folders().stream()
      .sorted(Comparator.comparing(folder -> pathFor(folder.id(), foldersById)))
      .map(folder -> pathFor(folder.id(), foldersById))
      .toList();
  }

  private Map<UUID, ArchiveFolder> indexFolders(ArchiveManifest manifest) {
    Map<UUID, ArchiveFolder> foldersById = new HashMap<>();
    manifest.folders().forEach(folder -> foldersById.put(folder.id(), folder));
    return foldersById;
  }

  private String pathFor(UUID folderId, Map<UUID, ArchiveFolder> foldersById) {
    List<String> segments = new ArrayList<>();
    ArchiveFolder current = foldersById.get(folderId);
    while (current != null) {
      segments.add(current.name());
      current = current.parentFolderId() == null ? null : foldersById.get(current.parentFolderId());
    }
    java.util.Collections.reverse(segments);
    return String.join(" / ", segments);
  }

  private Set<UUID> collectSubtree(UUID rootId, Map<UUID, Folder> allFolders) {
    Set<UUID> result = new LinkedHashSet<>();
    result.add(rootId);
    boolean added;
    do {
      added = false;
      for (Folder folder : allFolders.values()) {
        if (!result.contains(folder.getId()) && result.contains(folder.getParentFolderId())) {
          result.add(folder.getId());
          added = true;
        }
      }
    } while (added);
    return result;
  }

  private int folderDepth(Folder folder, Map<UUID, Folder> allFolders) {
    int depth = 0;
    Folder parent = allFolders.get(folder.getParentFolderId());
    while (parent != null) {
      depth++;
      parent = allFolders.get(parent.getParentFolderId());
    }
    return depth;
  }

  private int archiveFolderDepth(ArchiveFolder folder, Map<UUID, ArchiveFolder> allFolders) {
    int depth = 0;
    ArchiveFolder parent = allFolders.get(folder.parentFolderId());
    while (parent != null) {
      depth++;
      parent = allFolders.get(parent.parentFolderId());
    }
    return depth;
  }

  private List<AttachmentReference> attachmentReferences(String content) {
    Map<String, AttachmentReference> references = new LinkedHashMap<>();
    Matcher matcher = ATTACHMENT_URL.matcher(content == null ? "" : content);
    while (matcher.find()) {
      String id = matcher.group(1);
      String key;
      try {
        key = URLDecoder.decode(matcher.group(2), StandardCharsets.UTF_8);
      } catch (IllegalArgumentException exception) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note contains a malformed attachment URL.", exception);
      }
      if (!safeObjectKey(key) || !key.startsWith(id + "/")) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note contains an invalid attachment object key.");
      }
      references.putIfAbsent(attachmentIdentity(id, key), new AttachmentReference(id, key, fileName(key)));
    }
    return List.copyOf(references.values());
  }

  private String rewriteAttachmentUrls(String content, Map<String, AttachmentReference> importedAttachments) {
    Matcher matcher = ATTACHMENT_URL.matcher(content);
    StringBuffer rewritten = new StringBuffer();
    while (matcher.find()) {
      String oldId = matcher.group(1);
      String oldKey = URLDecoder.decode(matcher.group(2), StandardCharsets.UTF_8);
      AttachmentReference replacement = importedAttachments.get(attachmentIdentity(oldId, oldKey));
      if (replacement == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A note references an attachment that was not restored.");
      }
      String encodedKey = URLEncoder.encode(replacement.objectKey(), StandardCharsets.UTF_8).replace("+", "%20");
      String encodedName = URLEncoder.encode(replacement.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
      String url = "/api/attachments/" + replacement.id()
        + "?key=" + encodedKey + "&amp;fileName=" + encodedName;
      String sourceMatch = matcher.group();
      if ("true".equalsIgnoreCase(matcher.group(3))) url += "&amp;inline=true";
      matcher.appendReplacement(rewritten, Matcher.quoteReplacement(url));
    }
    matcher.appendTail(rewritten);
    return rewritten.toString();
  }

  private String validateArchivePath(String path) {
    String normalized = path.replace('\\', '/');
    if (normalized.isBlank() || normalized.startsWith("/") || normalized.matches("^[A-Za-z]:.*")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive contains an unsafe path.");
    }
    for (String segment : normalized.split("/")) {
      if (segment.isBlank() || segment.equals(".") || segment.equals("..")) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The archive contains an unsafe path.");
      }
    }
    return normalized;
  }

  private boolean safeObjectKey(String key) {
    if (key == null || key.isBlank() || key.startsWith("/") || key.contains("\\")) return false;
    for (String segment : key.split("/")) {
      if (segment.isBlank() || segment.equals(".") || segment.equals("..")) return false;
    }
    return true;
  }

  private boolean attachmentPathMatches(ArchiveAttachment attachment) {
    return attachment.archivePath().equals(
      "attachments/" + attachment.id() + "/" + fileName(attachment.fileName())
    );
  }

  private void validateFolderName(String name) {
    if (name == null || name.isBlank() || name.length() > 120 || name.equals(".") || name.equals("..")
      || name.contains("/") || name.contains("\\") || name.chars().anyMatch(Character::isISOControl)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A folder name in the archive is invalid.");
    }
  }

  private String uniqueFolderName(String sourceName, Set<String> usedNames) {
    String base = sourceName.trim();
    String candidate = base;
    int suffix = 1;
    while (!usedNames.add(normalizedName(candidate))) {
      suffix++;
      String ending = " (imported" + (suffix == 2 ? "" : " " + suffix) + ")";
      int maxBaseLength = 120 - ending.length();
      candidate = base.substring(0, Math.min(base.length(), maxBaseLength)).trim() + ending;
    }
    return candidate;
  }

  private String normalizedName(String name) {
    return name.toLowerCase(Locale.ROOT);
  }

  private String fileName(String key) {
    int separator = key.lastIndexOf('/');
    String name = separator < 0 ? key : key.substring(separator + 1);
    String safe = name.replaceAll("[\\\\/\\r\\n\"]", "_").trim();
    return safe.isBlank() || safe.equals(".") || safe.equals("..") ? "attachment" : safe;
  }

  private String attachmentIdentity(String id, String key) {
    return id + "\n" + key;
  }

  public record FolderArchiveExport(ArchiveManifest manifest, List<ArchiveAttachment> attachments) {}

  public record ArchiveManifest(
    int formatVersion,
    UUID rootFolderId,
    List<ArchiveFolder> folders,
    List<ArchiveNote> notes,
    List<ArchiveAttachment> attachments
  ) {}

  public record ArchiveFolder(
    UUID id,
    UUID parentFolderId,
    String name,
    Instant createdAt,
    Instant updatedAt
  ) {}

  public record ArchiveNote(
    UUID id,
    UUID folderId,
    String title,
    String content,
    String noteType,
    boolean favorite,
    boolean pinned,
    boolean archived,
    Instant createdAt,
    Instant updatedAt
  ) {}

  public record ArchiveAttachment(
    String id,
    String objectKey,
    String archivePath,
    String fileName,
    String contentType,
    long size
  ) {}

  public record ArchivePreview(
    int folderCount,
    int noteCount,
    int attachmentCount,
    String rootFolderName,
    List<String> folderPaths,
    List<PreviewNote> notes,
    List<String> warnings,
    UUID conflictFolderId,
    String conflictFolderName
  ) {}

  public record NoteArchivePreview(
    String title,
    String noteType,
    int attachmentCount,
    boolean favorite,
    boolean pinned,
    boolean archived,
    UUID existingNoteId,
    String existingNoteTitle
  ) {}

  public record PreviewNote(
    String title,
    String folderPath,
    String noteType,
    boolean favorite,
    boolean pinned,
    boolean archived
  ) {}

  public record ArchiveImportResult(
    UUID rootFolderId,
    String rootFolderName,
    int foldersCreated,
    int notesImported,
    int attachmentsRestored
  ) {}

  public record NoteImportResult(UUID noteId, String title, boolean overridden, int attachmentsRestored) {}

  public enum ImportStrategy {
    COPY,
    OVERRIDE
  }

  private record ParsedArchive(ArchiveManifest manifest, Map<String, byte[]> entries) {}
  private record AttachmentReference(String id, String objectKey, String fileName) {}
  private record UploadedObject(String id, String objectKey) {}
}
