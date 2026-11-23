package com.notesphere.storage;

import org.junit.jupiter.api.Test;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AttachmentControllerTest {
  @Test
  void downloadStreamsOriginalBytesAndFilenameAsAttachment() throws Exception {
    AttachmentService service = mock(AttachmentService.class);
    UUID id = UUID.randomUUID();
    byte[] bytes = {0, 1, (byte) 0x80, (byte) 0xff};
    AttachmentMetadata metadata = new AttachmentMetadata(
      id,
      "résumé.pdf",
      "résumé.pdf",
      "application/pdf",
      bytes.length,
      "pdf",
      Instant.now(),
      Instant.now()
    );
    when(service.getMetadata(id)).thenReturn(metadata);
    when(service.read(id)).thenReturn(bytes);

    ResponseEntity<StreamingResponseBody> response = new AttachmentController(service)
      .download(id, id + "/résumé.pdf", null, false);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    response.getBody().writeTo(output);

    assertEquals(MediaType.APPLICATION_PDF, response.getHeaders().getContentType());
    assertEquals(bytes.length, response.getHeaders().getContentLength());
    String dispositionHeader = response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);
    assertTrue(dispositionHeader.startsWith("attachment;"));
    assertEquals("résumé.pdf", ContentDisposition.parse(dispositionHeader).getFilename());
    assertArrayEquals(bytes, output.toByteArray());
  }
}
