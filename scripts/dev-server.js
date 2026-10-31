'use strict';
// Tiny local server that mimics the Vercel routes: `npm run dev` → http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const handlers = {
  '/api/wallpaper': require('../api/wallpaper'),
  '/api/random': require('../api/random'),
  '/api/styles': require('../api/styles'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let p = u.pathname;
  if (p.startsWith('/w/')) { u.searchParams.set('seed', decodeURIComponent(p.slice(3))); p = '/api/wallpaper'; }
  if (p === '/random') p = '/api/wallpaper';
  if (handlers[p]) {
    req.query = Object.fromEntries(u.searchParams);
    return handlers[p](req, res);
  }
  const file = path.join(__dirname, '..', 'public', p === '/' ? 'index.html' : p);
  if (!file.startsWith(path.join(__dirname, '..', 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Seedscape dev server on http://localhost:' + (process.env.PORT || 3000)));
