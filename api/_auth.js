// Shared helpers: PIN check, input checks, error handling.
const crypto = require('crypto');

const SECTIONS = ['veg', 'starch', 'fat', 'extra'];

function pinOk(req) {
  const want = process.env.APP_PIN || '';
  const got = String(req.headers['x-pin'] || '');
  if (!want) return false;
  const a = crypto.createHash('sha256').update(want).digest();
  const b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

// Wraps a handler: PIN required, errors become JSON.
function guarded(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!process.env.APP_PIN) return res.status(500).json({ error: 'APP_PIN is not set on the server.' });
    if (!pinOk(req)) return res.status(401).json({ error: 'Wrong PIN.' });
    try {
      await handler(req, res);
    } catch (e) {
      console.error('[api-error]', e);
      res.status(500).json({ error: e.expose ? e.message : 'Server error. Try again.' });
    }
  };
}

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 60);
const isSection = (s) => SECTIONS.includes(s);
const isPositive = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1e6;

module.exports = { guarded, cleanName, isSection, isPositive };
