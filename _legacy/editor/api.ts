// Client-side API helper. Reads the JS-readable CSRF cookie and echoes it back
// in the X-CSRF-Token header (double-submit pattern enforced server-side).
function csrf(): string {
  const m = document.cookie.match(/(?:^|;\s*)hm_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function req(method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrf(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (url: string) => req('GET', url),
  post: (url: string, body?: unknown) => req('POST', url, body),
  put: (url: string, body?: unknown) => req('PUT', url, body),
  patch: (url: string, body?: unknown) => req('PATCH', url, body),
  del: (url: string, body?: unknown) => req('DELETE', url, body),

  async upload(file: File): Promise<{ url: string; width: number; height: number }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { 'x-csrf-token': csrf() },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.media;
  },
};
