package com.notesphere.notes;

import java.time.Instant;
import java.util.UUID;

public record FolderResponse(
  UUID id,
  String name,
  UUID parentFolderId,
  long noteCount,
  Instant createdAt,
  Instant updatedAt
) {}
