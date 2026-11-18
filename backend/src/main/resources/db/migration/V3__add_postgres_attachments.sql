CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size >= 0),
  file_extension VARCHAR(32),
  file_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE note_attachments (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, attachment_id)
);

CREATE INDEX idx_note_attachments_attachment_id ON note_attachments(attachment_id);
