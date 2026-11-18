package com.notesphere.notes;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;
public interface NoteRepository extends JpaRepository<Note, UUID> {
  List<Note> findAllByOrderByUpdatedAtDesc();
  long countByFolder_Id(UUID folderId);

  @Modifying
  @Query("update Note n set n.folder = null where n.folder.id = :folderId")
  void moveNotesToUnfiled(@Param("folderId") UUID folderId);
}
