package com.notesphere.notes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "note_folders")
public class Folder {
  @Id
  @GeneratedValue
  private UUID id;

  @Column(nullable = false, length = 120)
  private String name;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "parent_folder_id")
  private Folder parent;

  @Column(nullable = false)
  private Instant createdAt;

  @Column(nullable = false)
  private Instant updatedAt;

  protected Folder() {}

  Folder(String name, Folder parent) {
    this.name = name;
    this.parent = parent;
  }

  @PrePersist
  void onCreate() {
    createdAt = Instant.now();
    updatedAt = createdAt;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public UUID getId() { return id; }
  public String getName() { return name; }
  public UUID getParentFolderId() { return parent == null ? null : parent.getId(); }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  void setName(String name) { this.name = name; }
  void setParent(Folder parent) { this.parent = parent; }
  Folder getParent() { return parent; }
  void restoreTimestamps(Instant createdAt, Instant updatedAt) {
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
