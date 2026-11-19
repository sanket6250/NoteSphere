export function normalizeAttachmentUrls(html, apiBase = '') {
  const base = apiBase.replace(/\/+$/, '');
  return (html || '').replace(
    /(?:https?:\/\/[^/"'<>\s]+)?(\/api\/attachments\/[^"'<>\s]+)/gi,
    (_, path) => `${base}${path}`,
  );
}
