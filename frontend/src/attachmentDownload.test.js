import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadAttachment, filenameFromContentDisposition } from './attachmentDownload.js';

test('reads UTF-8 and quoted filenames from Content-Disposition', () => {
  assert.equal(
    filenameFromContentDisposition("attachment; filename=\"fallback.pdf\"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf"),
    'résumé.pdf',
  );
  assert.equal(filenameFromContentDisposition('attachment; filename="report.docx"'), 'report.docx');
});

test('downloads the response blob and revokes its temporary URL', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const bytes = new Uint8Array([0, 1, 128, 255]);
  const downloads = [];
  const revoked = [];
  const appended = [];

  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, 'include');
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="original.pdf"',
      },
    });
  };
  URL.createObjectURL = (blob) => {
    assert.equal(blob.type, 'application/pdf');
    return 'blob:attachment-test';
  };
  URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.document = {
    createElement: () => ({
      click() { downloads.push({ href: this.href, filename: this.download }); },
      remove() {},
    }),
    body: { append: (link) => appended.push(link) },
  };
  globalThis.window = { setTimeout: (callback) => callback() };

  try {
    await downloadAttachment('/api/attachments/123', 'fallback.pdf');
    assert.equal(downloads.length, 1);
    assert.deepEqual(downloads[0], { href: 'blob:attachment-test', filename: 'original.pdf' });
    assert.equal(appended.length, 1);
    assert.deepEqual(revoked, ['blob:attachment-test']);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('reports server download errors rather than creating a download', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: 'Attachment not found.' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } },
  );

  try {
    await assert.rejects(downloadAttachment('/api/attachments/missing'), /Attachment not found\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
