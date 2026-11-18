package com.notesphere.notes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FolderRepository extends JpaRepository<Folder, UUID> {
  List<Folder> findAllByOrderByNameAsc();
  List<Folder> findByParent_IdOrderByNameAsc(UUID parentFolderId);
  List<Folder> findByParent_Id(UUID parentFolderId);
  boolean existsByNameIgnoreCaseAndParent_Id(String name, UUID parentFolderId);
  boolean existsByNameIgnoreCaseAndParentIsNull(String name);
}
