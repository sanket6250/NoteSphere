package com.notesphere.notes;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
public class FolderArchiveController {
  private final FolderArchiveService archives;

  public FolderArchiveController(FolderArchiveService archives) {
    this.archives = archives;
  }

  @GetMapping(value = "/{id}/export", produces = "application/zip")
  public ResponseEntity<StreamingResponseBody> export(@PathVariable UUID id) {
    FolderArchiveService.FolderArchiveExport archive = archives.prepareExport(id);
    String folderName = archive.manifest().folders().stream()
      .filter(folder -> folder.id().equals(id))
      .map(FolderArchiveService.ArchiveFolder::name)
      .findFirst()
      .orElse("folder")
      .replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
    StreamingResponseBody body = output -> archives.writeExport(archive, output);
    return ResponseEntity.ok()
      .contentType(MediaType.parseMediaType("application/zip"))
      .header(
        HttpHeaders.CONTENT_DISPOSITION,
        ContentDisposition.attachment()
          .filename(folderName + ".notesphere.zip", StandardCharsets.UTF_8)
          .build()
          .toString()
      )
      .header(HttpHeaders.CACHE_CONTROL, "no-store")
      .body(body);
  }

  @PostMapping(value = "/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FolderArchiveService.ArchivePreview preview(@RequestParam("file") MultipartFile file) {
    return archives.preview(file);
  }

  @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FolderArchiveService.ArchiveImportResult importArchive(
    @RequestParam("file") MultipartFile file,
    @RequestParam(defaultValue = "COPY") String strategy
  ) {
    return archives.importArchive(file, parseStrategy(strategy));
  }

  private FolderArchiveService.ImportStrategy parseStrategy(String strategy) {
    try {
      return FolderArchiveService.ImportStrategy.valueOf(strategy.toUpperCase(java.util.Locale.ROOT));
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Import strategy must be COPY or OVERRIDE.");
    }
  }
}
