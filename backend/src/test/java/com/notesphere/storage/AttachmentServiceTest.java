package com.notesphere.storage;

import com.notesphere.notes.NoteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

class AttachmentServiceTest {
  @Test
  void storesBinaryBytesAndLinksUploadToItsNote() throws Exception {
    AttachmentRepository repository = mock(AttachmentRepository.class);
    NoteRepository notes = mock(NoteRepository.class);
    NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    UUID noteId = UUID.randomUUID();
    byte[] bytes = {0, 1, (byte) 0x80, (byte) 0xff};
    when(notes.existsById(noteId)).thenReturn(true);
    when(repository.saveAndFlush(any(StoredAttachment.class))).thenAnswer(invocation -> invocation.getArgument(0));
    when(jdbc.update(anyString(), any(org.springframework.jdbc.core.namedparam.SqlParameterSource.class))).thenReturn(1);
    AttachmentService service = new AttachmentService(repository, notes, jdbc, DataSize.ofBytes(16));

    AttachmentMetadata result = service.upload(
      noteId,
      new MockMultipartFile("file", "..\\secret.pdf", "application/pdf", bytes)
    );

    org.mockito.ArgumentCaptor<StoredAttachment> stored = org.mockito.ArgumentCaptor.forClass(StoredAttachment.class);
    verify(repository).saveAndFlush(stored.capture());
    assertArrayEquals(bytes, stored.getValue().getFileData());
    assertEquals(".._secret.pdf", result.fileName());
    assertEquals(bytes.length, result.fileSize());
    verify(jdbc).update(anyString(), any(org.springframework.jdbc.core.namedparam.SqlParameterSource.class));
  }

  @Test
  void rejectsUploadsLargerThanConfiguredLimitBeforeReadingOrSaving() {
    AttachmentRepository repository = mock(AttachmentRepository.class);
    NoteRepository notes = mock(NoteRepository.class);
    NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    AttachmentService service = new AttachmentService(repository, notes, jdbc, DataSize.ofBytes(2));

    assertThrows(ResponseStatusException.class, () -> service.upload(
      UUID.randomUUID(),
      new MockMultipartFile("file", "large.bin", "application/octet-stream", new byte[]{1, 2, 3})
    ));

    verify(repository, never()).saveAndFlush(any(StoredAttachment.class));
  }

  @Test
  void doesNotReadFileBytesWhenAttachmentHasNoNoteRelationship() {
    AttachmentRepository repository = mock(AttachmentRepository.class);
    NoteRepository notes = mock(NoteRepository.class);
    NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    UUID attachmentId = UUID.randomUUID();
    AttachmentService service = new AttachmentService(repository, notes, jdbc, DataSize.ofMegabytes(1));
    when(repository.findLinkedMetadata(attachmentId)).thenReturn(Optional.empty());

    assertThrows(ResponseStatusException.class, () -> service.read(attachmentId));

    verify(repository, never()).findFileData(attachmentId);
  }
}
