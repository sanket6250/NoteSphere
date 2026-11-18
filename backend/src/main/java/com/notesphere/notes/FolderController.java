package com.notesphere.notes;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
public class FolderController {
  private final FolderRepository folders;
  private final NoteRepository notes;

  public FolderController(FolderRepository folders, NoteRepository notes) {
    this.folders = folders;
    this.notes = notes;
  }

  @GetMapping
  @Transactional(readOnly = true)
  public List<FolderResponse> list() {
    return folders.findAllByOrderByNameAsc().stream()
      .map(folder -> toResponse(folder, notes.countByFolder_Id(folder.getId())))
      .toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public FolderResponse create(@Valid @RequestBody FolderRequest request) {
    String name = request.name().trim();
    Folder parent = request.parentFolderId() == null ? null : getFolder(request.parentFolderId());
    ensureNameAvailable(name, parent, null);
    Folder folder = folders.save(new Folder(name, parent));
    return toResponse(folder, 0);
  }

  @PutMapping("/{id}")
  @Transactional
  public FolderResponse renameOrMove(@PathVariable UUID id, @Valid @RequestBody FolderRequest request) {
    Folder folder = getFolder(id);
    Folder parent = request.parentFolderId() == null ? null : getFolder(request.parentFolderId());
    if (parent != null && parent.getId().equals(id)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A folder cannot be its own parent");
    }
    ensureNotDescendant(parent, id);
    String name = request.name().trim();
    ensureNameAvailable(name, parent, id);
    folder.setName(name);
    folder.setParent(parent);
    Folder saved = folders.save(folder);
    return toResponse(saved, notes.countByFolder_Id(id));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(@PathVariable UUID id) {
    Folder folder = getFolder(id);
    List<Folder> children = folders.findByParent_Id(id);
    for (Folder child : children) {
      child.setParent(folder.getParent());
    }
    folders.saveAll(children);
    notes.moveNotesToUnfiled(id);
    folders.delete(folder);
  }

  private Folder getFolder(UUID id) {
    return folders.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
  }

  private void ensureNameAvailable(String name, Folder parent, UUID excludedId) {
    List<Folder> siblings = parent == null
      ? folders.findAllByOrderByNameAsc().stream().filter(folder -> folder.getParentFolderId() == null).toList()
      : folders.findByParent_Id(parent.getId());
    boolean duplicate = siblings.stream().anyMatch(folder ->
      !folder.getId().equals(excludedId) && folder.getName().equalsIgnoreCase(name));
    if (duplicate) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "A folder with this name already exists here");
    }
  }

  private void ensureNotDescendant(Folder parent, UUID folderId) {
    Folder ancestor = parent;
    while (ancestor != null) {
      if (ancestor.getId().equals(folderId)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A folder cannot be moved inside its own subfolder");
      }
      ancestor = ancestor.getParent();
    }
  }

  private FolderResponse toResponse(Folder folder, long noteCount) {
    return new FolderResponse(
      folder.getId(),
      folder.getName(),
      folder.getParentFolderId(),
      noteCount,
      folder.getCreatedAt(),
      folder.getUpdatedAt()
    );
  }
}
