package com.notesphere.storage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "attachments")
public class StoredAttachment {
  @Id
  private UUID id;

  @Column(name = "file_name", nullable = false, length = 255)
  private String fileName;

  @Column(name = "original_file_name", nullable = false, length = 255)
  private String originalFileName;

  @Column(name = "content_type", nullable = false, length = 255)
  private String contentType;

  @Column(name = "file_size", nullable = false)
  private long fileSize;

  @Column(name = "file_extension", length = 32)
  private String fileExtension;

  @Column(name = "file_data", nullable = false, columnDefinition = "bytea")
  private byte[] fileData;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected StoredAttachment() {}

  StoredAttachment(String fileName, String contentType, byte[] fileData) {
    this.id = UUID.randomUUID();
    this.fileName = fileName;
    this.originalFileName = fileName;
    this.contentType = contentType;
    this.fileSize = fileData.length;
    this.fileExtension = extensionOf(fileName);
    this.fileData = fileData;
  }

  @PrePersist
  void onCreate() {
    if (createdAt == null) createdAt = Instant.now();
    if (updatedAt == null) updatedAt = createdAt;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  private static String extensionOf(String name) {
    int dot = name.lastIndexOf('.');
    if (dot < 0 || dot == name.length() - 1) return null;
    String extension = name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
    return extension.length() <= 32 ? extension : extension.substring(0, 32);
  }

  public UUID getId() { return id; }
  public String getFileName() { return fileName; }
  public String getOriginalFileName() { return originalFileName; }
  public String getContentType() { return contentType; }
  public long getFileSize() { return fileSize; }
  public String getFileExtension() { return fileExtension; }
  public byte[] getFileData() { return fileData; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
}
