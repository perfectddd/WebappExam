const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbx9OgXHKMHA64v2m3B82rUf-kGG78eAClpg0dAnXkl9mP6xe_oe-8c_TWtuWbyyxxKqig/exec';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'รองรับเฉพาะ POST API' });
  }

  try {
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json' },
      body: payload,
      redirect: 'follow'
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      return res.status(502).json({ success: false, message: 'Apps Script ไม่ส่ง JSON กลับมา กรุณาตรวจสอบ deployment' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(upstream.ok ? 200 : 502).send(text);
  } catch (error) {
    return res.status(502).json({ success: false, message: 'เชื่อมต่อ Apps Script ไม่สำเร็จ' });
  }
}
