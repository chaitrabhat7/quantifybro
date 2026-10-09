// Local preview without Vercel: serves the page and runs the api/ functions the
// same way Vercel does (req.query, req.body, res.status().json()).
// Reads .env.local if present. No DATABASE_URL → saves to .local-data.json.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3100;

try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
if (!process.env.APP_PIN) { process.env.APP_PIN = '1234'; console.log('APP_PIN not set — using 1234 for local testing.'); }
if (!process.env.DATABASE_URL) delete process.env.DATABASE_URL;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return res; };

  const fn = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (fn) {
    const file = path.join(ROOT, 'api', fn[1] + '.js');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    req.query = Object.fromEntries(url.searchParams);
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = undefined; }
    delete require.cache[require.resolve(file)];
    return require(file)(req, res);
  }

  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || rel.startsWith('api') || rel.startsWith('.') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; return res.end('Not found');
  }
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log(`QuantifyBro on http://localhost:${PORT}`));
