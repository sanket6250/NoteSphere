export function filenameFromContentDisposition(header, fallback = 'attachment') {
  const encodedName = header?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encodedName) {
    try {
      return decodeURIComponent(encodedName.trim().replace(/^"|"$/g, ''));
    } catch {
      return fallback;
    }
  }

  const plainName = header?.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  return plainName?.[1] || plainName?.[2]?.trim() || fallback;
}

export async function downloadAttachment(
  url,
  fallbackName = 'attachment',
  request = (resource) => fetch(resource, { credentials: 'include' }),
) {
  const response = await request(url);
  if (!response.ok) {
    const responseText = await response.text();
    let message = responseText;
    try {
      const errorBody = JSON.parse(responseText);
      message = errorBody.detail || errorBody.message || message;
    } catch (parseError) {
      if (!(parseError instanceof SyntaxError)) throw parseError;
    }
    throw new Error(message || `Could not download attachment (${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error('The downloaded attachment is empty.');

  const responseName = filenameFromContentDisposition(
    response.headers.get('Content-Disposition'),
    fallbackName,
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = responseName;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
