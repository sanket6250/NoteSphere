package com.notesphere.storage;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {
  private final AttachmentService attachments;

  public AttachmentController(AttachmentService attachments) {
    this.attachments = attachments;
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, String> upload(
    @RequestParam("noteId") UUID noteId,
    @RequestParam("file") MultipartFile file
  ) {
    AttachmentMetadata saved = attachments.upload(noteId, file);
    String objectKey = saved.id() + "/" + saved.fileName();
    return Map.of(
      "id", saved.id().toString(),
      "fileName", saved.fileName(),
      "objectKey", objectKey,
      "size", Long.toString(saved.fileSize()),
      "contentType", saved.contentType()
    );
  }

  @GetMapping
  public java.util.List<AttachmentMetadata> list(@RequestParam UUID noteId) {
    return attachments.listForNote(noteId);
  }

  @GetMapping("/{id}")
  public ResponseEntity<StreamingResponseBody> download(
    @PathVariable UUID id,
    @RequestParam(required = false) String key,
    @RequestParam(required = false) String fileName,
    @RequestParam(defaultValue = "false") boolean inline
  ) {
    AttachmentMetadata metadata = attachments.getMetadata(id);
    String objectKey = id + "/" + metadata.fileName();
    if (key != null && !key.equals(objectKey)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid attachment key");
    }
    MediaType contentType;
    try {
      contentType = MediaType.parseMediaType(metadata.contentType());
    } catch (IllegalArgumentException exception) {
      contentType = MediaType.APPLICATION_OCTET_STREAM;
    }
    boolean showInline = inline && AttachmentService.canRenderInline(metadata.contentType());
    String disposition = ContentDisposition.builder(showInline ? "inline" : "attachment")
      .filename(metadata.originalFileName(), StandardCharsets.UTF_8)
      .build()
      .toString();
    StreamingResponseBody body = output -> output.write(attachments.read(id));
    return ResponseEntity.ok()
      .contentType(contentType)
      .contentLength(metadata.fileSize())
      .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
      .header("X-Content-Type-Options", "nosniff")
      .header(HttpHeaders.CACHE_CONTROL, "no-store")
      .body(body);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id, @RequestParam UUID noteId) {
    attachments.delete(noteId, id);
  }
}
