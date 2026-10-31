'use strict';
const { Seedscape, describe } = require('../lib/render');

/**
 * GET /api/random
 * Returns a fresh random seed (and ready-to-use image URLs) as JSON.
 * Add ?redirect=1 to be redirected straight to the image instead.
 */
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query || {};
  const styles = Object.keys(Seedscape.STYLES);
  const style = styles.includes(q.style) ? q.style : styles[Math.floor(Math.random() * styles.length)];
  const palettes = describe().palettes;
  const pal = palettes[Math.floor(Math.random() * palettes.length)].id;
  const seed = Seedscape.randomSeed();
  const params = new URLSearchParams({ seed, style, palette: pal });
  const path = `/api/wallpaper?${params}`;
  res.setHeader('Cache-Control', 'no-store');
  if (q.redirect !== undefined && q.redirect !== '0') {
    res.statusCode = 302; res.setHeader('Location', path); return res.end();
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = host ? `${proto}://${host}` : '';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ seed, style, palette: pal, url: base + path, app: `${base}/app#seed=${encodeURIComponent(seed)}&s=${style}&p=${encodeURIComponent(pal === 'auto' ? 'auto' : Object.keys(Seedscape.PALETTES).find((n) => n.toLowerCase().replace(/\s+/g, '-') === pal))}` }, null, 2));
};
