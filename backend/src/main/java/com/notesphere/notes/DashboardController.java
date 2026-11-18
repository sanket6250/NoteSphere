package com.notesphere.notes;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private static final int ACTIVITY_DAYS = 30;
  private static final int RECENT_LIMIT = 6;

  private final NoteRepository notes;
  private final FolderRepository folders;

  public DashboardController(NoteRepository notes, FolderRepository folders) {
    this.notes = notes;
    this.folders = folders;
  }

  @GetMapping
  @Transactional(readOnly = true)
  public DashboardSummary summary() {
    List<Note> allNotes = notes.findAllByOrderByUpdatedAtDesc();
    List<Folder> allFolders = folders.findAllByOrderByNameAsc();
    List<Note> activeNotes = allNotes.stream().filter(note -> !note.isArchived()).toList();
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LocalDate firstDay = today.minusDays(ACTIVITY_DAYS - 1);

    Map<LocalDate, Long> createdByDay = allNotes.stream()
      .map(Note::getCreatedAt)
      .filter(createdAt -> createdAt != null)
      .map(createdAt -> createdAt.atZone(ZoneOffset.UTC).toLocalDate())
      .filter(date -> !date.isBefore(firstDay) && !date.isAfter(today))
      .collect(Collectors.groupingBy(date -> date, Collectors.counting()));
    List<DailyActivity> activity = new ArrayList<>(ACTIVITY_DAYS);
    for (int day = 0; day < ACTIVITY_DAYS; day++) {
      LocalDate date = firstDay.plusDays(day);
      activity.add(new DailyActivity(date, createdByDay.getOrDefault(date, 0L)));
    }

    Map<UUID, Folder> foldersById = allFolders.stream()
      .collect(Collectors.toMap(Folder::getId, folder -> folder));
    Map<UUID, List<Note>> notesByFolder = allNotes.stream()
      .filter(note -> note.getFolderId() != null)
      .collect(Collectors.groupingBy(Note::getFolderId));
    List<FolderActivity> folderActivity = allFolders.stream()
      .map(folder -> {
        List<Note> folderNotes = notesByFolder.getOrDefault(folder.getId(), List.of());
        Instant lastEdited = folderNotes.stream()
          .map(Note::getUpdatedAt)
          .filter(updatedAt -> updatedAt != null)
          .max(Comparator.naturalOrder())
          .orElse(null);
        return new FolderActivity(
          folder.getId(),
          folderPath(folder, foldersById),
          folderNotes.size(),
          lastEdited
        );
      })
      .filter(folder -> folder.noteCount() > 0)
      .sorted(Comparator.comparingLong(FolderActivity::noteCount).reversed()
        .thenComparing(FolderActivity::lastEdited, Comparator.nullsLast(Comparator.reverseOrder())))
      .toList();

    List<Distribution> folderDistribution = new ArrayList<>();
    long unfiledCount = allNotes.stream().filter(note -> note.getFolderId() == null).count();
    if (unfiledCount > 0) folderDistribution.add(new Distribution("Unfiled", unfiledCount, null));
    folderActivity.stream()
      .map(folder -> new Distribution(folder.name(), folder.noteCount(), folder.folderId()))
      .forEach(folderDistribution::add);

    Map<String, Long> notesByType = allNotes.stream()
      .collect(Collectors.groupingBy(
        note -> note.getNoteType() == null ? "blank" : note.getNoteType(),
        Collectors.counting()
      ));
    List<Distribution> typeDistribution = notesByType.entrySet().stream()
      .map(entry -> new Distribution(entry.getKey(), entry.getValue(), null))
      .sorted(Comparator.comparingLong(Distribution::count).reversed()
        .thenComparing(Distribution::name))
      .toList();

    return new DashboardSummary(
      allNotes.size(),
      activeNotes.size(),
      allNotes.size() - activeNotes.size(),
      allFolders.size(),
      activity,
      folderDistribution,
      typeDistribution,
      folderActivity.stream().limit(5).toList(),
      activeNotes.stream().limit(RECENT_LIMIT)
        .map(note -> dashboardNote(note, foldersById))
        .toList(),
      activeNotes.stream().filter(Note::isFavorite).limit(RECENT_LIMIT)
        .map(note -> dashboardNote(note, foldersById))
        .toList(),
      activeNotes.stream().filter(Note::isPinned).limit(RECENT_LIMIT)
        .map(note -> dashboardNote(note, foldersById))
        .toList()
    );
  }

  private DashboardNote dashboardNote(Note note, Map<UUID, Folder> foldersById) {
    Folder folder = foldersById.get(note.getFolderId());
    String folderName = folder == null ? "Unfiled" : folderPath(folder, foldersById);
    return DashboardNote.from(note, folderName);
  }

  private String folderPath(Folder folder, Map<UUID, Folder> foldersById) {
    List<String> segments = new ArrayList<>();
    Folder current = folder;
    while (current != null) {
      segments.add(current.getName());
      current = foldersById.get(current.getParentFolderId());
    }
    java.util.Collections.reverse(segments);
    return String.join(" / ", segments);
  }

  public record DashboardSummary(
    long totalNotes,
    long activeNotes,
    long archivedNotes,
    long totalFolders,
    List<DailyActivity> notesCreatedOverTime,
    List<Distribution> notesByFolder,
    List<Distribution> notesByType,
    List<FolderActivity> mostActiveFolders,
    List<DashboardNote> recentlyEdited,
    List<DashboardNote> favorites,
    List<DashboardNote> pinned
  ) {}

  public record DailyActivity(LocalDate date, long count) {}

  public record Distribution(String name, long count, UUID folderId) {}

  public record FolderActivity(UUID folderId, String name, long noteCount, Instant lastEdited) {}

  public record DashboardNote(
    UUID id,
    String title,
    String noteType,
    UUID folderId,
    String folderName,
    Instant updatedAt
  ) {
    static DashboardNote from(Note note, String folderName) {
      return new DashboardNote(
        note.getId(),
        note.getTitle(),
        note.getNoteType(),
        note.getFolderId(),
        folderName,
        note.getUpdatedAt()
      );
    }
  }
}
