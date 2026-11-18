package com.notesphere.storage;

import java.time.Instant;
import java.util.UUID;

public record AttachmentMetadata(
  UUID id,
  String fileName,
  String originalFileName,
  String contentType,
  long fileSize,
  String fileExtension,
  Instant createdAt,
  Instant updatedAt
) {}
