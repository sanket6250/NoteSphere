package com.notesphere.notes;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
public class NoteController {
  private static final Set<String> NOTE_TYPES = Set.of(
    "blank", "meeting", "journal", "todo", "project", "study", "technical", "quick"
  );

  private final NoteRepository repo;
  private final FolderRepository folders;

  public NoteController(NoteRepository repo, FolderRepository folders) {
    this.repo = repo;
    this.folders = folders;
  }

  @GetMapping
  @Transactional(readOnly = true)
  public List<Note> list(
    @RequestParam(required = false) UUID folderId,
    @RequestParam(defaultValue = "false") boolean archived,
    @RequestParam(defaultValue = "false") boolean unfiled,
    @RequestParam(defaultValue = "false") boolean favorites,
    @RequestParam(required = false) String q
  ) {
    String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
    return repo.findAllByOrderByUpdatedAtDesc().stream()
      .filter(note -> archived ? note.isArchived() : !note.isArchived())
      .filter(note -> !unfiled || note.getFolderId() == null)
      .filter(note -> folderId == null || folderId.equals(note.getFolderId()))
      .filter(note -> !favorites || note.isFavorite())
      .filter(note -> query.isEmpty()
        || note.getTitle().toLowerCase(Locale.ROOT).contains(query)
        || note.getContent().toLowerCase(Locale.ROOT).contains(query))
      .toList();
  }

  @GetMapping("/{id}")
  public Note get(@PathVariable UUID id) {
    return repo.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public Note create(@Valid @RequestBody NoteRequest request) {
    Note note = new Note();
    applyRequest(note, request, true);
    return repo.save(note);
  }

  @PutMapping("/{id}")
  @Transactional
  public Note update(@PathVariable UUID id, @Valid @RequestBody NoteRequest request) {
    Note note = get(id);
    applyRequest(note, request, false);
    return repo.save(note);
  }

  @PatchMapping("/{id}/folder")
  @Transactional
  public Note move(@PathVariable UUID id, @RequestBody MoveNoteRequest request) {
    Note note = get(id);
    note.setFolder(request.folderId() == null ? null : getFolder(request.folderId()));
    return repo.save(note);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(@PathVariable UUID id) {
    if (!repo.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found");
    }
    repo.deleteById(id);
  }

  private void applyRequest(Note note, NoteRequest request, boolean creating) {
    note.setTitle(request.title().trim());
    note.setContent(request.content());
    if (request.noteType() != null) {
      String type = request.noteType().toLowerCase(Locale.ROOT);
      if (!NOTE_TYPES.contains(type)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported note type");
      }
      note.setNoteType(type);
    }
    if (request.folderId() != null) {
      note.setFolder(getFolder(request.folderId()));
    }
    if (request.favorite() != null) note.setFavorite(request.favorite());
    if (request.pinned() != null) note.setPinned(request.pinned());
    if (request.archived() != null) note.setArchived(request.archived());
    if (creating && request.folderId() == null) note.setFolder(null);
  }

  private Folder getFolder(UUID folderId) {
    return folders.findById(folderId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
  }
}
