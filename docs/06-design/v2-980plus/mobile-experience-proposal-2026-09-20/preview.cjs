// Design-only static preview. Uses the repository's registered mockup port.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const config = JSON.parse(fs.readFileSync(path.resolve(root, '../../../../config/local-ports.json'), 'utf8'));
const port = config.ports?.['mockups-static']?.port ?? config.services?.['mockups-static']?.port;
if (port !== 18185) throw new Error('Registered mockups-static port must be 18185');
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)); }
  catch { res.writeHead(400); res.end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep) || !types[path.extname(file)]) { res.writeHead(404); res.end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Mockup port 18185 is occupied; no alternate port will be used.' : error); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Mobile design preview: http://127.0.0.1:${port}`));
