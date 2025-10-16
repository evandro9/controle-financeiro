const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log('[mailer] (DEV) to:', to, '\nsubj:', subject, '\n', html);
    return { ok: true, dev: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.warn('[mailer][DEV] Resend failed:', res.status, txt);
      return { ok: false, dev: true };
    }
    throw new Error('Resend failed: ' + res.status + ' ' + txt);
  }
  return res.json();
}

module.exports = { sendEmail };