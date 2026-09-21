// Design-only static preview. Uses the repository's registered mockup port.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const officialRoot = path.resolve(root, '../official-site-experience-proposal-2026-09-21');
const config = JSON.parse(fs.readFileSync(path.resolve(root, '../../../../config/local-ports.json'), 'utf8'));
const port = config.ports?.['mockups-static']?.port ?? config.services?.['mockups-static']?.port;
if (port !== 18185) throw new Error('Registered mockups-static port must be 18185');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let file, servingRoot;
  try {
    const requestPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (requestPath === '/official') { res.writeHead(302, { Location: '/official/' }); res.end(); return; }
    const official = requestPath.startsWith('/official/');
    servingRoot = official ? officialRoot : root;
    const relativePath = official ? requestPath.slice('/official'.length) : requestPath;
    file = path.resolve(servingRoot, '.' + relativePath);
  }
  catch { res.writeHead(400); res.end(); return; }
  if (file === servingRoot) file = path.join(servingRoot, 'index.html');
  if (!file.startsWith(servingRoot + path.sep) || !types[path.extname(file)]) { res.writeHead(404); res.end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Mockup port 18185 is occupied; no alternate port will be used.' : error); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Design previews: mobile http://127.0.0.1:${port}/ | official site http://127.0.0.1:${port}/official/`));
