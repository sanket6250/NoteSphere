package com.notesphere.notes;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
public class NoteArchiveController {
  private final FolderArchiveService archives;

  public NoteArchiveController(FolderArchiveService archives) {
    this.archives = archives;
  }

  @GetMapping(value = "/{id}/export", produces = "application/zip")
  public ResponseEntity<StreamingResponseBody> export(@PathVariable UUID id) {
    FolderArchiveService.FolderArchiveExport archive = archives.prepareNoteExport(id);
    String title = archive.manifest().notes().getFirst().title()
      .replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
    StreamingResponseBody body = output -> archives.writeExport(archive, output);
    return ResponseEntity.ok()
      .contentType(MediaType.parseMediaType("application/zip"))
      .header(
        HttpHeaders.CONTENT_DISPOSITION,
        ContentDisposition.attachment()
          .filename(title + ".notesphere-note.zip", StandardCharsets.UTF_8)
          .build()
          .toString()
      )
      .header(HttpHeaders.CACHE_CONTROL, "no-store")
      .body(body);
  }

  @PostMapping(value = "/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FolderArchiveService.NoteArchivePreview preview(@RequestParam("file") MultipartFile file) {
    return archives.previewNote(file);
  }

  @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FolderArchiveService.NoteImportResult importNote(
    @RequestParam("file") MultipartFile file,
    @RequestParam(defaultValue = "COPY") String strategy
  ) {
    FolderArchiveService.ImportStrategy parsedStrategy;
    try {
      parsedStrategy = FolderArchiveService.ImportStrategy.valueOf(strategy.toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Import strategy must be COPY or OVERRIDE.");
    }
    return archives.importNote(file, parsedStrategy);
  }
}
