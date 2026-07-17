// The deployment URL is public configuration, not a credential. Keep it pinned
// here so a stale Vercel environment variable cannot route login to old code.
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx9OgXHKMHA64v2m3B82rUf-kGG78eAClpg0dAnXkl9mP6xe_oe-8c_TWtuWbyyxxKqig/exec';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'รองรับเฉพาะ POST API' });
  }

  try {
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const upstream = await requestAppsScript(GOOGLE_APPS_SCRIPT_URL, 'POST', payload);
    const text = upstream.body;
    const contentType = upstream.contentType;
    if (!contentType.includes('json')) {
      return res.status(502).json({ success: false, message: 'Apps Script ไม่ส่ง JSON กลับมา กรุณาตรวจสอบ deployment' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(upstream.status >= 200 && upstream.status < 300 ? 200 : 502).send(text);
  } catch (error) {
    console.error('Apps Script proxy failed:', error);
    return res.status(502).json({ success: false, message: 'เชื่อมต่อ Apps Script ไม่สำเร็จ', code: 'UPSTREAM_FETCH_FAILED', detail: String(error && error.message || 'unknown').slice(0, 160) });
  }
}

function requestAppsScript(url, method, body, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method,
      headers: method === 'POST' ? {
        'Content-Type': 'text/plain; charset=utf-8',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : { Accept: 'application/json' }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 3) {
        response.resume();
        requestAppsScript(response.headers.location, 'GET', '', redirects + 1).then(resolve, reject);
        return;
      }
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => resolve({ status: response.statusCode || 500, contentType: response.headers['content-type'] || '', body: data }));
    });
    request.setTimeout(20000, () => request.destroy(new Error('Apps Script request timed out')));
    request.on('error', reject);
    if (method === 'POST') request.write(body);
    request.end();
  });
}
import https from 'node:https';
