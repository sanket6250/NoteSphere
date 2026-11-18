package com.notesphere.notes;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="notes")
public class Note {
  @Id @GeneratedValue private UUID id;
  @Column(nullable=false,length=300) private String title;
  @Column(nullable=false,columnDefinition="text") private String content;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="folder_id") private Folder folder;
  @Column(nullable=false,length=40,columnDefinition="varchar(40) not null default 'blank'") private String noteType="blank";
  @Column(nullable=false,columnDefinition="boolean not null default false") private boolean favorite;
  @Column(nullable=false,columnDefinition="boolean not null default false") private boolean pinned;
  @Column(nullable=false,columnDefinition="boolean not null default false") private boolean archived;
  @Column(nullable=false) private Instant createdAt;
  @Column(nullable=false) private Instant updatedAt;
  @PrePersist void onCreate(){
    if(createdAt==null) createdAt=Instant.now();
    if(updatedAt==null) updatedAt=createdAt;
  }
  @PreUpdate void onUpdate(){ updatedAt=Instant.now(); }
  public UUID getId(){return id;} public String getTitle(){return title;} public String getContent(){return content;}
  public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
  public UUID getFolderId(){return folder==null?null:folder.getId();}
  public String getNoteType(){return noteType;} public boolean isFavorite(){return favorite;}
  public boolean isPinned(){return pinned;} public boolean isArchived(){return archived;}
  public void setTitle(String title){this.title=title;} public void setContent(String content){this.content=content;}
  public void setFolder(Folder folder){this.folder=folder;}
  public void setNoteType(String noteType){this.noteType=noteType;}
  public void setFavorite(boolean favorite){this.favorite=favorite;}
  public void setPinned(boolean pinned){this.pinned=pinned;}
  public void setArchived(boolean archived){this.archived=archived;}
  void restoreTimestamps(Instant createdAt, Instant updatedAt) {
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
