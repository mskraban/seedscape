'use strict';
// Generates the favicon set and the 1200x630 social preview image. Run: npm run assets
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const E = require('../public/engine.js');
const pub = path.join(__dirname, '..', 'public');

GlobalFonts.registerFromPath(path.join(pub, 'fonts/bricolage-grotesque-latin-wght-normal.woff2'), 'Bricolage');
GlobalFonts.registerFromPath(path.join(pub, 'fonts/inter-latin-wght-normal.woff2'), 'InterV');
GlobalFonts.registerFromPath(path.join(pub, 'fonts/jetbrains-mono-latin-wght-normal.woff2'), 'MonoV');

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset=".55" stop-color="#ff5ca8"/><stop offset="1" stop-color="#ffc15c"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#0b0c11"/><rect x="11" y="33" width="12" height="20" rx="3" fill="url(#g)"/><rect x="26" y="17" width="12" height="36" rx="3" fill="url(#g)"/><rect x="41" y="25" width="12" height="28" rx="3" fill="url(#g)"/></svg>\n`;
fs.writeFileSync(path.join(pub, 'favicon.svg'), logoSvg);

function mark(ctx, x, y, size, withBg = true) {
  const k = size / 64;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  const g = ctx.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, '#8b6cff'); g.addColorStop(0.55, '#ff5ca8'); g.addColorStop(1, '#ffc15c');
  if (withBg) { ctx.fillStyle = '#0b0c11'; ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 16); ctx.fill(); }
  ctx.fillStyle = g;
  for (const [bx, by, bh] of [[11, 33, 20], [26, 17, 36], [41, 25, 28]]) { ctx.beginPath(); ctx.roundRect(bx, by, 12, bh, 3); ctx.fill(); }
  ctx.restore();
}
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon-32.png', 32]]) {
  const c = createCanvas(size, size), x = c.getContext('2d');
  if (name.startsWith('apple')) { x.fillStyle = '#0b0c11'; x.fillRect(0, 0, size, size); mark(x, size * 0.1, size * 0.1, size * 0.8, false); } else mark(x, 0, 0, size);
  fs.writeFileSync(path.join(pub, name), c.toBuffer('image/png'));
}

// ── social preview (Open Graph / Twitter) ──
const W = 1200, H = 630, c = createCanvas(W, H), x = c.getContext('2d');
const bg = E.render(E.normalize({ seed: 'golden-fox-212', style: 'synthwave', palette: 'neon', w: String(W), h: String(H), px: '4', grain: '0' }), createCanvas, 0.12);
x.drawImage(bg, 0, 0);
const shade = x.createLinearGradient(0, 0, W * 0.78, 0);
shade.addColorStop(0, 'rgba(8,9,13,0.96)'); shade.addColorStop(0.55, 'rgba(8,9,13,0.72)'); shade.addColorStop(1, 'rgba(8,9,13,0.05)');
x.fillStyle = shade; x.fillRect(0, 0, W, H);
mark(x, 72, 64, 64);
x.fillStyle = '#eceef5'; x.font = '700 40px Bricolage'; x.fillText('Seedscape', 150, 110);
x.font = '800 98px Bricolage'; x.fillStyle = '#ffffff';
x.fillText('Wallpapers from', 72, 290); x.fillText('a single word.', 72, 396);
const tg = x.createLinearGradient(72, 0, 700, 0); tg.addColorStop(0, '#a58bff'); tg.addColorStop(0.6, '#ff5ca8'); tg.addColorStop(1, '#ffc15c');
x.fillStyle = tg; x.font = '800 98px Bricolage'; x.fillText('a single word.', 72, 396);
x.fillStyle = '#b9c0d3'; x.font = '500 30px InterV'; x.fillText('35 animated styles · free image API · open source', 74, 470);
let cx = 74;
for (const t of ['same seed, same art', 'seamless loops', 'MIT']) {
  x.font = '600 22px MonoV'; const tw = x.measureText(t).width;
  x.fillStyle = 'rgba(255,255,255,0.10)'; x.beginPath(); x.roundRect(cx, 520, tw + 36, 46, 23); x.fill();
  x.fillStyle = '#eceef5'; x.fillText(t, cx + 18, 551); cx += tw + 52;
}
fs.writeFileSync(path.join(pub, 'og.png'), c.toBuffer('image/png'));
console.log('assets written: favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192/512.png, og.png');
