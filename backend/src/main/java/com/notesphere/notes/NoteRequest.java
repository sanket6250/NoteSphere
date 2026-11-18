package com.notesphere.notes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
public record NoteRequest(
  @NotBlank @Size(max=300) String title,
  @NotBlank String content,
  UUID folderId,
  @Size(max=40) String noteType,
  Boolean favorite,
  Boolean pinned,
  Boolean archived
) {}
