import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAttachmentUrls } from './attachmentUrls.js';

test('normalizes imported relative attachment URLs to the configured API origin', () => {
  const html = '<a href="/api/attachments/123?key=123%2Fnotes.pdf&amp;fileName=notes.pdf">Download</a>';

  assert.equal(
    normalizeAttachmentUrls(html, 'https://notesphere-api.example/'),
    '<a href="https://notesphere-api.example/api/attachments/123?key=123%2Fnotes.pdf&amp;fileName=notes.pdf">Download</a>',
  );
});

test('replaces stale attachment hosts while preserving the endpoint and query', () => {
  const html = '<img src="https://old-api.example/api/attachments/123?key=123%2Fphoto.png&amp;inline=true">';

  assert.equal(
    normalizeAttachmentUrls(html, 'https://notesphere-api.example'),
    '<img src="https://notesphere-api.example/api/attachments/123?key=123%2Fphoto.png&amp;inline=true">',
  );
});

test('keeps same-origin attachment URLs when no API origin is configured', () => {
  const html = '<a href="/api/attachments/123?key=123%2Ffile.pdf">Download</a>';

  assert.equal(normalizeAttachmentUrls(html), html);
});
