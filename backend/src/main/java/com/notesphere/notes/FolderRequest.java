package com.notesphere.notes;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FolderRequest(
  @NotBlank @Size(max = 120) String name,
  UUID parentFolderId
) {}
