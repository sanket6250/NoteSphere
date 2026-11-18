CREATE TABLE note_folders (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  parent_folder_id UUID REFERENCES note_folders(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_note_folders_parent_folder_id ON note_folders(parent_folder_id);

ALTER TABLE notes
  ADD COLUMN folder_id UUID REFERENCES note_folders(id),
  ADD COLUMN note_type VARCHAR(40) NOT NULL DEFAULT 'blank',
  ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_notes_folder_id ON notes(folder_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);
