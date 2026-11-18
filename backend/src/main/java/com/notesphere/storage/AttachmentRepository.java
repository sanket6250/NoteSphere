package com.notesphere.storage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttachmentRepository extends JpaRepository<StoredAttachment, UUID> {
  @Query(value = """
    SELECT a.id AS id, a.file_name AS "fileName", a.original_file_name AS "originalFileName",
           a.content_type AS "contentType", a.file_size AS "fileSize",
           a.file_extension AS "fileExtension", a.created_at AS "createdAt",
           a.updated_at AS "updatedAt"
    FROM attachments a
    WHERE a.id = :id
    """, nativeQuery = true)
  Optional<AttachmentMetadataView> findMetadata(@Param("id") UUID id);

  @Query(value = """
    SELECT a.id AS id, a.file_name AS "fileName", a.original_file_name AS "originalFileName",
           a.content_type AS "contentType", a.file_size AS "fileSize",
           a.file_extension AS "fileExtension", a.created_at AS "createdAt",
           a.updated_at AS "updatedAt"
    FROM attachments a
    JOIN note_attachments na ON na.attachment_id = a.id
    WHERE na.note_id = :noteId
    ORDER BY a.created_at, a.id
    """, nativeQuery = true)
  List<AttachmentMetadataView> findMetadataByNoteId(@Param("noteId") UUID noteId);

  @Query(value = """
    SELECT a.id AS id, a.file_name AS "fileName", a.original_file_name AS "originalFileName",
           a.content_type AS "contentType", a.file_size AS "fileSize",
           a.file_extension AS "fileExtension", a.created_at AS "createdAt",
           a.updated_at AS "updatedAt"
    FROM attachments a
    JOIN note_attachments na ON na.attachment_id = a.id
    WHERE a.id = :id
    """, nativeQuery = true)
  Optional<AttachmentMetadataView> findLinkedMetadata(@Param("id") UUID id);

  @Query(value = "SELECT file_data FROM attachments WHERE id = :id", nativeQuery = true)
  Optional<byte[]> findFileData(@Param("id") UUID id);

  @Query(value = """
    SELECT attachment_id
    FROM note_attachments
    WHERE note_id IN (:noteIds)
    """, nativeQuery = true)
  List<UUID> findAttachmentIdsByNoteIds(@Param("noteIds") List<UUID> noteIds);

  interface AttachmentMetadataView {
    UUID getId();
    String getFileName();
    String getOriginalFileName();
    String getContentType();
    long getFileSize();
    String getFileExtension();
    Instant getCreatedAt();
    Instant getUpdatedAt();
  }
}
