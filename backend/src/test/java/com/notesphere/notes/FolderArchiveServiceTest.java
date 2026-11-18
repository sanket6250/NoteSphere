package com.notesphere.notes;

import com.notesphere.storage.AttachmentService;
import com.notesphere.storage.StoredAttachment;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.util.zip.ZipInputStream;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

class FolderArchiveServiceTest {
  private FolderArchiveService archives;
  private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
  private FolderRepository folders;
  private NoteRepository notes;
  private AttachmentService attachments;

  @BeforeEach
  void setUp() {
    folders = mock(FolderRepository.class);
    notes = mock(NoteRepository.class);
    attachments = mock(AttachmentService.class);
    archives = new FolderArchiveService(
      folders,
      notes,
      attachments,
      objectMapper,
      DataSize.ofMegabytes(2)
    );
  }

  @Test
  void previewsAValidEmptyFolderArchive() throws Exception {
    UUID folderId = UUID.randomUUID();
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1,
      folderId,
      List.of(new FolderArchiveService.ArchiveFolder(folderId, null, "Research", Instant.EPOCH, Instant.EPOCH)),
      List.of(),
      List.of()
    );

    FolderArchiveService.ArchivePreview preview = archives.preview(archive(manifest));

    assertEquals("Research", preview.rootFolderName());
    assertEquals(1, preview.folderCount());
    assertEquals(0, preview.noteCount());
    assertEquals(List.of("Research"), preview.folderPaths());
  }

  @Test
  void rejectsZipEntriesThatAttemptPathTraversal() throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      zip.putNextEntry(new ZipEntry("../manifest.json"));
      zip.write("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
      zip.closeEntry();
    }
    MockMultipartFile file = new MockMultipartFile("file", "unsafe.zip", "application/zip", bytes.toByteArray());

    assertThrows(ResponseStatusException.class, () -> archives.preview(file));
  }

  @Test
  void previewsReferencedAttachmentsFromHtmlContent() throws Exception {
    UUID folderId = UUID.randomUUID();
    String attachmentId = UUID.randomUUID().toString();
    String objectKey = attachmentId + "/diagram.png";
    String encodedKey = URLEncoder.encode(objectKey, StandardCharsets.UTF_8);
    String content = "<p><img src=\"http://notes.example/api/attachments/" + attachmentId
      + "?key=" + encodedKey + "&amp;fileName=diagram.png&amp;inline=true\"></p>";
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1,
      folderId,
      List.of(new FolderArchiveService.ArchiveFolder(folderId, null, "Engineering", Instant.EPOCH, Instant.EPOCH)),
      List.of(new FolderArchiveService.ArchiveNote(
        UUID.randomUUID(), folderId, "Design", content, "technical", true, false, false, Instant.EPOCH, Instant.EPOCH
      )),
      List.of(new FolderArchiveService.ArchiveAttachment(
        attachmentId, objectKey, "attachments/" + attachmentId + "/diagram.png",
        "diagram.png", "image/png", 1
      ))
    );

    FolderArchiveService.ArchivePreview preview = archives.preview(
      archive(manifest, Map.of("attachments/" + attachmentId + "/diagram.png", new byte[]{1}))
    );

    assertEquals(1, preview.attachmentCount());
    assertEquals(1, preview.noteCount());
  }

  @Test
  void previewsSingleNoteArchiveAndReportsDuplicateNote() throws Exception {
    UUID folderId = UUID.randomUUID();
    UUID noteId = UUID.randomUUID();
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1,
      folderId,
      List.of(new FolderArchiveService.ArchiveFolder(folderId, null, "Research", Instant.EPOCH, Instant.EPOCH)),
      List.of(new FolderArchiveService.ArchiveNote(
        noteId, folderId, "Field notes", "<p>Observations</p>", "journal", true, true, false,
        Instant.EPOCH, Instant.EPOCH
      )),
      List.of()
    );
    when(folders.findById(folderId)).thenReturn(Optional.empty());
    when(notes.findById(noteId)).thenReturn(Optional.empty());
    when(notes.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of());

    FolderArchiveService.NoteArchivePreview preview = archives.previewNote(archive(manifest));

    assertEquals("Field notes", preview.title());
    assertEquals("journal", preview.noteType());
    assertEquals(0, preview.attachmentCount());
    assertNull(preview.existingNoteId());
  }

  @Test
  void copiesAnExistingNoteWithoutMutatingIt() throws Exception {
    UUID folderId = UUID.randomUUID();
    UUID noteId = UUID.randomUUID();
    Folder folder = mock(Folder.class);
    Note existing = mock(Note.class);
    when(folder.getId()).thenReturn(folderId);
    when(folders.findById(folderId)).thenReturn(Optional.of(folder));
    when(notes.findById(noteId)).thenReturn(Optional.of(existing));
    when(notes.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of(existing));
    when(existing.getTitle()).thenReturn("Field notes");
    when(existing.getFolderId()).thenReturn(folderId);
    when(notes.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1,
      folderId,
      List.of(new FolderArchiveService.ArchiveFolder(folderId, null, "Research", Instant.EPOCH, Instant.EPOCH)),
      List.of(new FolderArchiveService.ArchiveNote(
        noteId, folderId, "Field notes", "<p>Observations</p>", "journal", true, true, false,
        Instant.EPOCH, Instant.EPOCH
      )),
      List.of()
    );
    ArgumentCaptor<Note> savedNote = ArgumentCaptor.forClass(Note.class);

    FolderArchiveService.NoteImportResult result = archives.importNote(
      archive(manifest),
      FolderArchiveService.ImportStrategy.COPY
    );

    verify(notes).save(savedNote.capture());
    assertNotSame(existing, savedNote.getValue());
    assertEquals("Field notes (imported)", savedNote.getValue().getTitle());
    assertEquals(folderId, savedNote.getValue().getFolderId());
    verify(existing, never()).setTitle(any());
    assertEquals("Field notes (imported)", result.title());
    assertEquals(false, result.overridden());
  }

  @Test
  void rejectsFolderArchiveInTheIndividualNoteImportPreview() throws Exception {
    UUID folderId = UUID.randomUUID();
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1,
      folderId,
      List.of(new FolderArchiveService.ArchiveFolder(folderId, null, "Research", Instant.EPOCH, Instant.EPOCH)),
      List.of(),
      List.of()
    );

    assertThrows(ResponseStatusException.class, () -> archives.previewNote(archive(manifest)));
  }

  @Test
  void exportsActualAttachmentBytesInTheZip() throws Exception {
    UUID attachmentId = UUID.randomUUID();
    byte[] content = {0, 1, (byte) 0x80, (byte) 0xff};
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1, UUID.randomUUID(), List.of(), List.of(), List.of()
    );
    FolderArchiveService.ArchiveAttachment attachment = new FolderArchiveService.ArchiveAttachment(
      attachmentId.toString(), attachmentId + "/photo.png", "attachments/" + attachmentId + "/photo.png",
      "photo.png", "image/png", content.length
    );
    when(attachments.read(attachmentId)).thenReturn(content);
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();

    archives.writeExport(new FolderArchiveService.FolderArchiveExport(manifest, List.of(attachment)), bytes);

    try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes.toByteArray()), StandardCharsets.UTF_8)) {
      assertEquals("manifest.json", zip.getNextEntry().getName());
      zip.closeEntry();
      assertEquals(attachment.archivePath(), zip.getNextEntry().getName());
      assertArrayEquals(content, zip.readAllBytes());
    }
  }

  @Test
  void noteImportRestoresBytesAndRewritesAttachmentUrl() throws Exception {
    UUID sourceFolderId = UUID.randomUUID();
    UUID sourceNoteId = UUID.randomUUID();
    UUID sourceAttachmentId = UUID.randomUUID();
    UUID restoredAttachmentId = UUID.randomUUID();
    String objectKey = sourceAttachmentId + "/image.png";
    String encodedKey = URLEncoder.encode(objectKey, StandardCharsets.UTF_8);
    byte[] content = {0, 5, (byte) 0xfe, (byte) 0xff};
    String noteContent = "<img src=\"/api/attachments/" + sourceAttachmentId
      + "?key=" + encodedKey + "&amp;fileName=image.png&amp;inline=true\">";
    FolderArchiveService.ArchiveManifest manifest = new FolderArchiveService.ArchiveManifest(
      1,
      sourceFolderId,
      List.of(new FolderArchiveService.ArchiveFolder(sourceFolderId, null, "Notes", Instant.EPOCH, Instant.EPOCH)),
      List.of(new FolderArchiveService.ArchiveNote(
        sourceNoteId, sourceFolderId, "Photo", noteContent, "blank", false, false, false, Instant.EPOCH, Instant.EPOCH
      )),
      List.of(new FolderArchiveService.ArchiveAttachment(
        sourceAttachmentId.toString(), objectKey, "attachments/" + objectKey,
        "image.png", "image/png", content.length
      ))
    );
    StoredAttachment restored = mock(StoredAttachment.class);
    when(restored.getId()).thenReturn(restoredAttachmentId);
    when(restored.getFileName()).thenReturn("image.png");
    when(attachments.storeImported(eq("image.png"), eq("image/png"), any(byte[].class))).thenReturn(restored);
    when(folders.findById(sourceFolderId)).thenReturn(Optional.empty());
    when(notes.findById(sourceNoteId)).thenReturn(Optional.empty());
    when(notes.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of());
    when(notes.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

    FolderArchiveService.NoteImportResult result = archives.importNote(
      archive(manifest, Map.of("attachments/" + objectKey, content)),
      FolderArchiveService.ImportStrategy.COPY
    );

    assertEquals(1, result.attachmentsRestored());
    ArgumentCaptor<byte[]> restoredBytes = ArgumentCaptor.forClass(byte[].class);
    verify(attachments).storeImported(eq("image.png"), eq("image/png"), restoredBytes.capture());
    assertArrayEquals(content, restoredBytes.getValue());
    ArgumentCaptor<Note> savedNote = ArgumentCaptor.forClass(Note.class);
    verify(notes).save(savedNote.capture());
    org.junit.jupiter.api.Assertions.assertTrue(
      savedNote.getValue().getContent().contains("/api/attachments/" + restoredAttachmentId)
    );
    verify(attachments).syncNoteAttachments(savedNote.getValue().getId(), savedNote.getValue().getContent());
  }

  private MockMultipartFile archive(FolderArchiveService.ArchiveManifest manifest) throws Exception {
    return archive(manifest, Map.of());
  }

  private MockMultipartFile archive(FolderArchiveService.ArchiveManifest manifest, Map<String, byte[]> entries) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      zip.putNextEntry(new ZipEntry("manifest.json"));
      zip.write(objectMapper.writeValueAsBytes(manifest));
      zip.closeEntry();
      for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
        zip.putNextEntry(new ZipEntry(entry.getKey()));
        zip.write(entry.getValue());
        zip.closeEntry();
      }
    }
    return new MockMultipartFile("file", "backup.zip", "application/zip", bytes.toByteArray());
  }
}
