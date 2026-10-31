/*!
 * Seedscape engine — deterministic generative wallpapers.
 * Pure JavaScript + Canvas 2D API. Runs unchanged in the browser and in Node
 * (with @napi-rs/canvas). Same seed + same options => same pixels.
 * MIT License
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Seedscape = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const VERSION = 1;

/* ───────────────────────── Seeded randomness ───────────────────────── */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(str) {
  const next = mulberry32(xmur3(str)());
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

/* ───────────────────────── Colour helpers ───────────────────────── */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a) => a === undefined || a === 1
  ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
  : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
/* Sample a palette (sorted dark → light) at t in [0,1]. */
function colorAt(pal, t) {
  t = clamp(t, 0, 1) * (pal.length - 1);
  const i = Math.floor(t);
  return i >= pal.length - 1 ? pal[pal.length - 1] : mix(pal[i], pal[i + 1], t - i);
}

/* ───────────────────────── Palettes ───────────────────────── */
const PALETTES = {
  'Dusk':     ['#0b1026', '#2b1b52', '#7b2d8e', '#e0457b', '#ff9a62', '#ffd9a0'],
  'Ocean':    ['#03162b', '#06406b', '#0b7a9b', '#29b6c9', '#8ee3de', '#e6fbf1'],
  'Forest':   ['#0a1f14', '#14452d', '#2f7a43', '#7fb069', '#d6e6a3', '#f6f1d0'],
  'Neon':     ['#0d0221', '#261447', '#750d8f', '#ff2a6d', '#05d9e8', '#d1f7ff'],
  'Pastel':   ['#3a3d5c', '#7d7fa8', '#b8a6d9', '#f2a7c3', '#ffd6a5', '#fff4e0'],
  'Desert':   ['#2a1810', '#6b3a24', '#b8643a', '#e29a54', '#f1cf8e', '#fbf0d6'],
  'Candy':    ['#2d1b4e', '#6a3d9a', '#ef5da8', '#ff9ac2', '#7ee8e0', '#fff7fb'],
  'Autumn':   ['#1f1209', '#5a2a14', '#a63d1a', '#e07a1f', '#f2b845', '#f7e4b5'],
  'Arctic':   ['#0c1b33', '#1c3f6e', '#3f7cac', '#95bde0', '#d9ecf7', '#ffffff'],
  'Sakura':   ['#2b1a2f', '#6b2c5c', '#c2538f', '#f29cb7', '#fbd5dc', '#fff6f2'],
  'Game Boy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  'Mono':     ['#0a0a0a', '#2a2a2a', '#5a5a5a', '#9a9a9a', '#d4d4d4', '#fafafa'],
};

function autoPalette(rng) {
  const base = rng.range(0, 360);
  const scheme = rng.pick(['analogous', 'complementary', 'triad', 'split', 'mono']);
  const offs = {
    analogous: [0, 25, 50, -25], complementary: [0, 180, 20, 200],
    triad: [0, 120, 240, 15], split: [0, 150, 210, 30], mono: [0, 8, -8, 16],
  }[scheme];
  const n = rng.int(5, 6);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hue = base + offs[i % offs.length] + rng.range(-8, 8);
    const sat = clamp(rng.range(45, 90) - (t > 0.85 ? 20 : 0), 20, 95);
    out.push(hsl(hue, sat, 8 + t * 84));
  }
  return out;
}

function getPalette(st) {
  let pal = st.pal === 'auto' || !PALETTES[st.pal]
    ? autoPalette(makeRng(`${st.seed}|pal|v${VERSION}`))
    : PALETTES[st.pal].map(hexToRgb);
  pal = pal.slice().sort((a, b) => lum(a) - lum(b));   // dark → light
  if (st.invert) pal.reverse();                        // light → dark swaps the whole mood
  return pal;
}

/* ───────────────────────── Drawing helpers ───────────────────────── */
function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = css(color);
  cx = Math.round(cx); cy = Math.round(cy);
  const y0 = Math.floor(-ry), y1 = Math.ceil(ry);
  for (let dy = y0; dy <= y1; dy++) {
    const t = ry === 0 ? 0 : dy / ry;
    const k = 1 - t * t;
    if (k < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(k));
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}
function drawBands(ctx, w, h, top, bot, y1, bands) {
  ctx.fillStyle = css(bot);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < bands; i++) {
    const t = bands === 1 ? 0 : i / (bands - 1);
    const ya = Math.floor((i * y1) / bands), yb = Math.floor(((i + 1) * y1) / bands);
    ctx.fillStyle = css(mix(top, bot, Math.pow(t, 1.15)));
    ctx.fillRect(0, ya, w, Math.max(1, yb - ya));
  }
}
function makeNoise1D(rng, octaves) {
  const N = 256, tables = [];
  for (let o = 0; o < octaves; o++) {
    const t = new Float32Array(N);
    for (let i = 0; i < N; i++) t[i] = rng.next();
    tables.push(t);
  }
  return (x) => {
    let sum = 0, amp = 1, tot = 0, freq = 1;
    for (let o = 0; o < octaves; o++) {
      const xx = x * freq, i = Math.floor(xx), f = xx - i, s = f * f * (3 - 2 * f);
      const a = tables[o][((i % N) + N) % N], b = tables[o][(((i + 1) % N) + N) % N];
      sum += (a + (b - a) * s) * amp; tot += amp; amp *= 0.5; freq *= 2;
    }
    return sum / tot;
  };
}

/* ───────────────────────── Styles ───────────────────────── */

/* 1 ─ Horizon: layered pixel-art landscape with sun / moon, stars, pines */
function horizon(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), u = Math.max(1, Math.round(m / 270));
  const horizonY = Math.floor(h * rng.range(0.52, 0.7));
  const night = rng.chance(0.6);
  const top = colorAt(pal, night ? rng.range(0, 0.12) : rng.range(0.3, 0.5));
  const bot = colorAt(pal, night ? rng.range(0.45, 0.7) : rng.range(0.7, 0.9));
  const skyAt = (y) => mix(top, bot, clamp(y / horizonY, 0, 1));
  drawBands(ctx, w, h, top, bot, Math.min(h, horizonY + Math.floor(h * 0.08)), clamp(Math.round(h / 14), 8, 48));

  if (night) {
    const starCol = colorAt(pal, 1);
    const n = Math.round((w * h) / (700 * u * u));
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rng.next() * w), y = Math.floor(rng.next() * horizonY * 0.85), b = rng.next();
      ctx.fillStyle = css(mix(skyAt(y), starCol, 0.35 + 0.65 * b));
      ctx.fillRect(x, y, u, u);
      if (b > 0.93) { ctx.fillRect(x - u, y, 3 * u, u); ctx.fillRect(x, y - u, u, 3 * u); }
    }
  }

  // sun / moon with stepped glow
  const sunCol = colorAt(pal, rng.range(0.88, 1));
  const r = Math.round(m * rng.range(0.07, 0.13));
  const cx = Math.round(w * rng.range(0.18, 0.82));
  const cy = Math.round(horizonY * rng.range(0.3, 0.75));
  const steps = 4;
  for (let k = steps; k >= 1; k--) {
    const rr = Math.round(r * (1 + 0.4 * k));
    fillEllipse(ctx, cx, cy, rr, rr, mix(skyAt(cy), sunCol, 0.07 * (steps + 1 - k)));
  }
  const striped = rng.chance(0.3);
  ctx.fillStyle = css(sunCol);
  for (let dy = -r; dy <= r; dy++) {
    if (striped && dy > r * 0.1 && Math.floor((dy - r * 0.1) / Math.max(u, r * 0.12)) % 2 === 1) continue;
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }

  // clouds
  const nClouds = rng.int(0, 3);
  for (let i = 0; i < nClouds; i++) {
    const ccx = w * rng.range(0.05, 0.95), ccy = horizonY * rng.range(0.15, 0.6), cw = m * rng.range(0.12, 0.28);
    const col = mix(skyAt(ccy), colorAt(pal, 0.85), 0.28);
    fillEllipse(ctx, ccx, ccy, cw * 0.5, cw * 0.08, col);
    fillEllipse(ctx, ccx - cw * 0.18, ccy - cw * 0.04, cw * 0.25, cw * 0.07, col);
    fillEllipse(ctx, ccx + cw * 0.2, ccy - cw * 0.02, cw * 0.2, cw * 0.06, col);
  }

  // mountain layers
  const noise = makeNoise1D(rng, 4);
  const L = rng.int(3, 5);
  const darkest = colorAt(pal, 0.0);
  const farthest = mix(bot, darkest, 0.35);
  let lastRidge = null, lastCol = darkest;
  for (let l = 0; l < L; l++) {
    const t = L === 1 ? 1 : l / (L - 1);
    const col = mix(farthest, darkest, Math.pow(t, 0.85));
    const base = lerp(horizonY * 0.98, h * 0.9, t);
    const amp = h * rng.range(0.15, 0.21);
    const cycles = rng.range(2, 4) * (1 + 0.5 * t);
    const offs = rng.range(0, 200);
    const ridge = new Int32Array(w);
    ctx.fillStyle = css(col);
    for (let x = 0; x < w; x++) {
      const y = Math.floor(base - amp * (noise(offs + (x / w) * cycles) * 1.4 - 0.35));
      ridge[x] = y;
      ctx.fillRect(x, y, 1, h - y);
    }
    lastRidge = ridge; lastCol = col;
  }

  // pines on the front ridge
  if (rng.chance(0.75)) {
    const tw = Math.max(3, Math.round(m / 50));
    ctx.fillStyle = css(lastCol);
    for (let x = rng.int(0, tw); x < w; x += Math.max(2, Math.round(tw * rng.range(0.7, 1.7)))) {
      if (!rng.chance(0.8)) continue;
      const th = Math.round(tw * rng.range(2.2, 3.6)), y = lastRidge[x];
      for (let i = 0; i < th; i++) {
        const wd = Math.max(1, Math.floor(tw * (i / th)) | 1);
        ctx.fillRect(x - (wd >> 1), y - th + i + 2, wd, 1);
      }
    }
  }
}

/* 2 ─ Aurora: soft glowing blobs on a dark sky */
function aurora(ctx, w, h, rng, pal) {
  const m = Math.min(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(colorAt(pal, 0.0)));
  g.addColorStop(1, css(colorAt(pal, 0.16)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'screen';
  const n = rng.int(6, 10);
  for (let i = 0; i < n; i++) {
    const x = w * rng.range(-0.1, 1.1), y = h * rng.range(-0.1, 1.1), r = m * rng.range(0.3, 0.85);
    const col = colorAt(pal, rng.range(0.3, 1));
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, css(col, rng.range(0.35, 0.7)));
    rg.addColorStop(0.5, css(col, 0.14));
    rg.addColorStop(1, css(col, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }
  // a few thin bright ribbons
  ctx.globalCompositeOperation = 'lighter';
  const ribbons = rng.int(1, 3);
  for (let i = 0; i < ribbons; i++) {
    const col = colorAt(pal, rng.range(0.6, 0.95));
    const y0 = h * rng.range(0.25, 0.75), a1 = h * rng.range(0.06, 0.18), f = rng.range(0.8, 2.2), ph = rng.range(0, 6.28);
    ctx.lineWidth = Math.max(1, m * rng.range(0.004, 0.012));
    ctx.strokeStyle = css(col, 0.22);
    ctx.beginPath();
    for (let x = 0; x <= w; x += Math.max(1, w / 120)) {
      const y = y0 + Math.sin((x / w) * Math.PI * 2 * f + ph) * a1;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* 3 ─ Mosaic: tiled symmetric space-invader sprites */
function mosaic(ctx, w, h, rng, pal) {
  const m = Math.min(w, h);
  const bg = colorAt(pal, 0.04);
  ctx.fillStyle = css(bg);
  ctx.fillRect(0, 0, w, h);
  const S = rng.pick([5, 7]);
  const tc = rng.int(5, 10);
  let dot = Math.max(1, Math.floor(m / tc / (S + 1)));
  const tile = dot * (S + 1);
  const half = Math.ceil(S / 2);
  const tint = colorAt(pal, rng.range(0.1, 0.3));
  const x0 = Math.floor((w % tile) / 2) - tile, y0 = Math.floor((h % tile) / 2) - tile;
  const checker = rng.chance(0.6);
  for (let ty = 0, y = y0; y < h; y += tile, ty++) {
    for (let tx = 0, x = x0; x < w; x += tile, tx++) {
      if (checker && (tx + ty) % 2 === 0) {
        ctx.fillStyle = css(mix(bg, tint, 0.35));
        ctx.fillRect(x, y, tile, tile);
      }
      if (rng.chance(0.12)) continue;
      const col = colorAt(pal, rng.range(0.35, 1));
      ctx.fillStyle = css(col);
      const pad = dot >> 1;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < half; sx++) {
          if (!rng.chance(0.5)) continue;
          ctx.fillRect(x + pad + sx * dot, y + pad + sy * dot, dot, dot);
          if (sx !== S - 1 - sx) ctx.fillRect(x + pad + (S - 1 - sx) * dot, y + pad + sy * dot, dot, dot);
        }
      }
    }
  }
}

/* 4 ─ Waves: stacked sine ridges with a hazy sun */
function waves(ctx, w, h, rng, pal) {
  const m = Math.min(w, h);
  const top = colorAt(pal, rng.range(0.02, 0.12)), bot = colorAt(pal, rng.range(0.55, 0.8));
  drawBands(ctx, w, h, top, bot, h, clamp(Math.round(h / 12), 8, 56));
  if (rng.chance(0.7)) {
    const sunCol = colorAt(pal, rng.range(0.9, 1)), r = Math.round(m * rng.range(0.08, 0.16));
    const cx = Math.round(w * rng.range(0.2, 0.8)), cy = Math.round(h * rng.range(0.22, 0.42));
    for (let k = 3; k >= 1; k--) fillEllipse(ctx, cx, cy, r * (1 + 0.35 * k), r * (1 + 0.35 * k), mix(mix(top, bot, cy / h), sunCol, 0.09 * (4 - k)));
    fillEllipse(ctx, cx, cy, r, r, sunCol);
  }
  const n = rng.int(5, 9);
  for (let l = 0; l < n; l++) {
    const t = l / (n - 1);
    const base = lerp(h * 0.38, h * 0.88, t);
    const amp = h * rng.range(0.025, 0.07) * (0.6 + t);
    const waves = [0, 1, 2].map(() => ({ f: rng.range(0.5, 3.2) * Math.PI * 2 / w, p: rng.range(0, 6.28), a: rng.range(0.3, 1) }));
    ctx.fillStyle = css(colorAt(pal, lerp(0.78, 0.0, t)));
    for (let x = 0; x < w; x++) {
      let y = base;
      for (const wv of waves) y += Math.sin(x * wv.f + wv.p) * amp * wv.a;
      y = Math.floor(y);
      ctx.fillRect(x, y, 1, h - y);
    }
  }
}

/* 5 ─ Geometric: Bauhaus-style tiles */
function geometric(ctx, w, h, rng, pal) {
  const m = Math.min(w, h);
  const t = Math.max(4, Math.round(m / rng.int(3, 7)));
  const x0 = Math.floor((w % t) / 2) - t, y0 = Math.floor((h % t) / 2) - t;
  for (let y = y0; y < h; y += t) {
    for (let x = x0; x < w; x += t) {
      const bi = rng.int(0, pal.length - 1);
      let fi = rng.int(0, pal.length - 1);
      if (fi === bi) fi = (bi + 2) % pal.length;
      const bg = pal[bi], fg = pal[fi];
      ctx.fillStyle = css(bg);
      ctx.fillRect(x, y, t, t);
      ctx.save();
      ctx.translate(x + t / 2, y + t / 2);
      ctx.rotate(rng.int(0, 3) * Math.PI / 2);
      const a = t / 2;
      ctx.fillStyle = css(fg);
      switch (rng.int(0, 7)) {
        case 0: ctx.beginPath(); ctx.moveTo(-a, -a); ctx.arc(-a, -a, t, 0, Math.PI / 2); ctx.closePath(); ctx.fill(); break;
        case 1: ctx.beginPath(); ctx.arc(0, a, a, Math.PI, Math.PI * 2); ctx.fill(); break;
        case 2: ctx.beginPath(); ctx.arc(0, 0, a * 0.8, 0, Math.PI * 2); ctx.fill(); break;
        case 3: ctx.beginPath(); ctx.moveTo(-a, a); ctx.lineTo(a, a); ctx.lineTo(a, -a); ctx.closePath(); ctx.fill(); break;
        case 4:
          ctx.beginPath(); ctx.arc(0, 0, a * 0.92, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = css(bg); ctx.beginPath(); ctx.arc(0, 0, a * 0.62, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = css(fg); ctx.beginPath(); ctx.arc(0, 0, a * 0.32, 0, Math.PI * 2); ctx.fill();
          break;
        case 5: for (let i = 0; i < 4; i += 2) ctx.fillRect(-a + (i * t) / 4, -a, t / 4, t); break;
        case 6: ctx.beginPath(); ctx.moveTo(0, -a); ctx.lineTo(a, 0); ctx.lineTo(0, a); ctx.lineTo(-a, 0); ctx.closePath(); ctx.fill(); break;
        default:
          ctx.beginPath(); ctx.moveTo(-a, -a); ctx.arc(-a, -a, a, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(a, a); ctx.arc(a, a, a, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
}

/* 6 ─ Automata: 1-D cellular automata, one generation per row */
function automata(ctx, w, h, rng, pal) {
  const cs = rng.pick([1, 1, 2, 3]);
  const cols = Math.ceil(w / cs), rows = Math.ceil(h / cs);
  const rule = rng.pick([30, 90, 110, 18, 22, 54, 126, 150, 60, 102, 45, 105]);
  let cur = new Uint8Array(cols), nxt = new Uint8Array(cols);
  const mode = rng.pick(['center', 'few', 'few', 'dense']);
  if (mode === 'center') cur[cols >> 1] = 1;
  else if (mode === 'few') { const n = rng.int(2, 9); for (let i = 0; i < n; i++) cur[rng.int(0, cols - 1)] = 1; }
  else { const d = rng.range(0.03, 0.2); for (let i = 0; i < cols; i++) if (rng.next() < d) cur[i] = 1; }

  const img = ctx.createImageData(w, h), d = img.data;
  const bgTop = colorAt(pal, 0.02), bgBot = colorAt(pal, 0.14);
  for (let y = 0; y < h; y++) {
    const c = mix(bgTop, bgBot, y / h);
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  }
  const freq = rng.range(0.4, 1.4);
  const tri = (v) => 1 - Math.abs(2 * (v - Math.floor(v)) - 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cur[c]) {
        const col = colorAt(pal, 0.35 + 0.65 * tri((c / cols) * freq + (r / rows) * 0.6));
        for (let dy = 0; dy < cs; dy++) for (let dx = 0; dx < cs; dx++) {
          const x = c * cs + dx, y = r * cs + dy;
          if (x >= w || y >= h) continue;
          const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
        }
      }
      nxt[c] = (rule >> ((cur[(c - 1 + cols) % cols] << 2) | (cur[c] << 1) | cur[(c + 1) % cols])) & 1;
    }
    [cur, nxt] = [nxt, cur];
  }
  ctx.putImageData(img, 0, 0);
}

/* ───────────────────────── More helpers ───────────────────────── */

/* 2-D value noise with fractal octaves (deterministic, uses the style's rng). */
function makeNoise2D(rng) {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rng.next();
  const base = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = vals[P[P[X] + Y]], b = vals[P[P[X + 1] + Y]], c = vals[P[P[X] + Y + 1]], d = vals[P[P[X + 1] + Y + 1]];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 1, tot = 0, f = 1;
    for (let o = 0; o < oct; o++) { s += base(x * f + o * 17.3, y * f + o * 9.1) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
}
function poly(ctx, pts, color, seam) {
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  if (seam) { ctx.strokeStyle = css(color); ctx.lineWidth = seam; ctx.stroke(); }
}
/* Evaluate fn(x, y) -> [r, g, b] for every pixel and write the result in one go. */
function pixelField(ctx, w, h, fn) {
  const img = ctx.createImageData(w, h), d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2]; d[i++] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
function scatterStars(ctx, w, h, rng, color, bg, yMax, density) {
  const m = Math.min(w, h), u = Math.max(1, Math.round(m / 270));
  const n = Math.round((w * h) / (density * u * u));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rng.next() * w), y = Math.floor(rng.next() * yMax), b = rng.next();
    ctx.fillStyle = css(mix(bg, color, 0.25 + 0.75 * b));
    ctx.fillRect(x, y, u, u);
    if (b > 0.94) { ctx.fillRect(x - u, y, 3 * u, u); ctx.fillRect(x, y - u, u, 3 * u); }
  }
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* 7 ─ Cubes: isometric "tumbling blocks" */
function cubes(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), s = m / rng.range(4, 8), dx = s * Math.sqrt(3), dy = s * 1.5, hx = dx / 2;
  ctx.fillStyle = css(colorAt(pal, 0.02));
  ctx.fillRect(0, 0, w, h);
  const mono = rng.chance(0.4), baseIdx = rng.range(0.35, 0.85);
  const light = colorAt(pal, 1), dark = colorAt(pal, 0);
  const rows = Math.ceil(h / dy) + 2, cols = Math.ceil(w / dx) + 2;
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = c * dx + (r & 1 ? hx : 0), cy = r * dy;
      const base = colorAt(pal, mono ? clamp(baseIdx + rng.range(-0.08, 0.08), 0, 1) : rng.range(0.3, 0.95));
      poly(ctx, [[cx, cy - s], [cx + hx, cy - s / 2], [cx, cy], [cx - hx, cy - s / 2]], mix(base, light, 0.35), 1);
      poly(ctx, [[cx - hx, cy - s / 2], [cx, cy], [cx, cy + s], [cx - hx, cy + s / 2]], base, 1);
      poly(ctx, [[cx, cy], [cx + hx, cy - s / 2], [cx + hx, cy + s / 2], [cx, cy + s]], mix(base, dark, 0.5), 1);
    }
  }
}

/* 8 ─ Topo: contour-map terrain, filled or line-only */
function topo(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), noise = makeNoise2D(rng);
  const sc = rng.range(1.6, 3.2), ox = rng.range(0, 50), oy = rng.range(0, 50);
  const N = rng.int(9, 16), linesOnly = rng.chance(0.45);
  const bg = colorAt(pal, 0.03), k = Math.max(1, Math.round(m / 540));
  const band = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = clamp((noise(ox + (x / m) * sc, oy + (y / m) * sc, 4) - 0.28) / 0.44, 0, 0.999);
    band[y * w + x] = Math.floor(t * N);
  }
  const dark = colorAt(pal, 0), tint = colorAt(pal, 0.12);
  pixelField(ctx, w, h, (x, y) => {
    const i = y * w + x, b = band[i], f = b / (N - 1);
    const edge = (x + k < w && band[i + k] !== b) || (y + k < h && band[i + k * w] !== b);
    if (linesOnly) return edge ? colorAt(pal, 0.35 + 0.65 * f) : mix(bg, tint, f * 0.6);
    const base = colorAt(pal, f);
    return edge ? mix(base, dark, 0.55) : base;
  });
}

/* 9 ─ Truchet: quarter-arc ribbons that tile into endless paths */
function truchet(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), t = Math.max(6, Math.round(m / rng.int(5, 12)));
  const bg = colorAt(pal, rng.range(0.02, 0.1));
  ctx.fillStyle = css(bg); ctx.fillRect(0, 0, w, h);
  const ca = colorAt(pal, rng.range(0.55, 0.95));
  const cb = rng.chance(0.5) ? colorAt(pal, rng.range(0.25, 0.5)) : bg;
  const lw1 = t * rng.range(0.28, 0.42), lw2 = lw1 * rng.range(0.3, 0.5), multi = rng.chance(0.4);
  const x0 = Math.floor((w % t) / 2) - t, y0 = Math.floor((h % t) / 2) - t, r = t / 2;
  for (let y = y0; y < h; y += t) {
    for (let x = x0; x < w; x += t) {
      const flip = rng.next() < 0.5, col = multi ? colorAt(pal, rng.range(0.4, 1)) : ca;
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath();
      if (!flip) {
        ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI / 2);
        ctx.moveTo(r, t); ctx.arc(t, t, r, Math.PI, Math.PI * 1.5);
      } else {
        ctx.moveTo(t, r); ctx.arc(t, 0, r, Math.PI / 2, Math.PI);
        ctx.moveTo(0, r); ctx.arc(0, t, r, -Math.PI / 2, 0);
      }
      ctx.lineWidth = lw1; ctx.strokeStyle = css(col); ctx.stroke();
      ctx.lineWidth = lw2; ctx.strokeStyle = css(cb); ctx.stroke();
      ctx.restore();
    }
  }
}

/* 10 ─ Cosmos: nebula clouds and stars */
function cosmos(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), n1 = makeNoise2D(rng), n2 = makeNoise2D(rng);
  const s1 = rng.range(1.2, 2.6), s2 = rng.range(1.5, 3);
  const o = [rng.range(0, 50), rng.range(0, 50), rng.range(0, 50), rng.range(0, 50)];
  const bg = colorAt(pal, 0.0), bg2 = colorAt(pal, 0.1);
  pixelField(ctx, w, h, (x, y) => {
    const u = x / m, v = y / m;
    let dens = clamp((n1(o[0] + u * s1, o[1] + v * s1, 5) - 0.38) * 2.6, 0, 1);
    dens = dens * dens * (3 - 2 * dens);
    const col = colorAt(pal, 0.3 + 0.7 * n2(o[2] + u * s2, o[3] + v * s2, 4));
    return mix(mix(bg, bg2, y / h), col, dens * 0.9);
  });
  scatterStars(ctx, w, h, rng, colorAt(pal, 1), bg, h, 500);
}

/* 11 ─ Stained: Voronoi cells with dark lead lines */
function stained(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), c = Math.max(8, Math.round(m / rng.int(5, 9)));
  const gw = Math.ceil(w / c) + 3, gh = Math.ceil(h / c) + 3;
  const pts = [];
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++)
    pts.push({ x: (gx - 1 + rng.range(0.1, 0.9)) * c, y: (gy - 1 + rng.range(0.1, 0.9)) * c, t: rng.next() });
  const border = Math.max(1, c * 0.07), line = mix(colorAt(pal, 0), colorAt(pal, 0.08), 0.5), light = colorAt(pal, 1);
  pixelField(ctx, w, h, (x, y) => {
    const cx = Math.floor(x / c) + 1, cy = Math.floor(y / c) + 1;
    let d1 = 1e9, d2 = 1e9, p1 = null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const p = pts[(cy + dy) * gw + (cx + dx)], d = Math.hypot(p.x - x, p.y - y);
      if (d < d1) { d2 = d1; d1 = d; p1 = p; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < border) return line;
    return mix(colorAt(pal, 0.2 + 0.8 * p1.t), light, clamp(0.35 * (1 - d1 / c), 0, 0.35));
  });
}

/* 12 ─ Rays: retro sunburst */
function rays(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), cx = w * rng.range(0.3, 0.7), cy = h * rng.range(0.35, 0.75), R = Math.hypot(w, h);
  const n = rng.pick([12, 16, 20, 24, 32, 40]), a0 = rng.range(0, Math.PI * 2);
  const ca = colorAt(pal, rng.range(0.25, 0.45)), cb = colorAt(pal, rng.range(0.5, 0.7));
  ctx.fillStyle = css(ca); ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(cb);
  for (let i = 0; i < n; i++) {
    const s = a0 + (i * 2 * Math.PI) / n;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, s, s + Math.PI / n); ctx.closePath(); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75);
  g.addColorStop(0, css(colorAt(pal, 1), 0.55));
  g.addColorStop(0.35, css(colorAt(pal, 0.9), 0.12));
  g.addColorStop(1, css(colorAt(pal, 0), 0.6));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = m * rng.range(0.09, 0.15), sun = colorAt(pal, rng.range(0.9, 1));
  for (let k = 3; k >= 1; k--) fillEllipse(ctx, cx, cy, r * (1 + 0.3 * k), r * (1 + 0.3 * k), mix(cb, sun, 0.12 * (4 - k)));
  fillEllipse(ctx, cx, cy, r, r, sun);
}

/* 13 ─ Skyline: night city with lit windows */
function skyline(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), u = Math.max(1, Math.round(m / 270));
  const top = colorAt(pal, rng.range(0, 0.1)), bot = colorAt(pal, rng.range(0.45, 0.7));
  drawBands(ctx, w, h, top, bot, Math.floor(h * 0.85), clamp(Math.round(h / 14), 8, 48));
  scatterStars(ctx, w, h, rng, colorAt(pal, 1), top, h * 0.45, 900);
  const mr = Math.round(m * rng.range(0.05, 0.09)), mx = Math.round(w * rng.range(0.15, 0.85)), my = Math.round(h * rng.range(0.15, 0.4));
  const moon = colorAt(pal, rng.range(0.9, 1));
  for (let k = 3; k >= 1; k--) fillEllipse(ctx, mx, my, mr * (1 + 0.45 * k), mr * (1 + 0.45 * k), mix(mix(top, bot, my / h), moon, 0.08 * (4 - k)));
  fillEllipse(ctx, mx, my, mr, mr, moon);
  const dark = colorAt(pal, 0), winCol = colorAt(pal, rng.range(0.85, 1)), L = 3;
  for (let l = 0; l < L; l++) {
    const t = l / (L - 1);
    const col = mix(mix(bot, dark, 0.45), dark, t);
    const wcol = mix(col, winCol, l === 1 ? 0.55 : 1);
    const prob = l === 1 ? 0.3 : 0.4;
    let x = -rng.int(0, Math.round(m * 0.05));
    while (x < w) {
      const bw = Math.max(4, Math.round(m * rng.range(0.05, 0.13) * (0.8 + 0.5 * t)));
      const bh = Math.round(h * rng.range(0.12, 0.38) * (0.65 + 0.35 * t));
      const y = h - bh - Math.round((1 - t) * h * 0.04);
      ctx.fillStyle = css(col); ctx.fillRect(x, y, bw, h - y);
      if (rng.chance(0.25)) ctx.fillRect(x + (bw >> 1), y - Math.round(bh * 0.18), Math.max(1, u), Math.round(bh * 0.18));
      if (l > 0) {
        const sx = Math.max(2 * u, Math.round(bw / 5)), sy = Math.max(3 * u, Math.round(sx * 1.4)), ww = Math.max(u, Math.round(sx * 0.45));
        for (let yy = y + sy; yy < h - sy; yy += sy) for (let xx = x + sx * 0.6; xx < x + bw - ww; xx += sx) {
          if (!rng.chance(prob)) continue;
          ctx.fillStyle = css(wcol); ctx.fillRect(Math.round(xx), yy, ww, Math.max(u, Math.round(ww * 1.2)));
        }
      }
      x += bw + rng.int(0, Math.round(bw * 0.2));
    }
  }
}

/* 14 ─ Spiro: layered hypotrochoids with additive glow */
function spiro(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), u = Math.max(1, Math.round(m / 270)), cx = w / 2, cy = h / 2, S = m * 0.5;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) / 2);
  g.addColorStop(0, css(colorAt(pal, 0.12))); g.addColorStop(1, css(colorAt(pal, 0)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  const R = rng.int(5, 11), r = rng.int(2, R - 1), k = (R - r) / r, loops = r / gcd(R, r);
  const count = rng.int(36, 90), dphi = rng.range(0.02, 0.09), norm = S / (R - r + r * 1.15);
  const N = Math.round(loops * 180);
  ctx.lineWidth = Math.max(1, u * 0.5); ctx.lineJoin = 'round';
  for (let j = 0; j < count; j++) {
    const t = j / count, d = r * (0.35 + 0.8 * t), phi = j * dphi, cs = Math.cos(phi), sn = Math.sin(phi);
    ctx.strokeStyle = css(colorAt(pal, 0.45 + 0.55 * t), 0.22);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * loops * Math.PI * 2;
      const px = (R - r) * Math.cos(a) + d * Math.cos(k * a), py = (R - r) * Math.sin(a) - d * Math.sin(k * a);
      const X = cx + (px * cs - py * sn) * norm, Y = cy + (px * sn + py * cs) * norm;
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* 15 ─ Flow: particles tracing a noise field */
function flow(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), u = Math.max(1, Math.round(m / 270)), noise = makeNoise2D(rng);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(colorAt(pal, 0))); g.addColorStop(1, css(colorAt(pal, 0.12)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const sc = rng.range(1.5, 3.5), ox = rng.range(0, 50), oy = rng.range(0, 50), turn = rng.range(2, 5);
  ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = Math.max(1, u * 0.7); ctx.lineCap = 'round';
  const n = Math.round((w * h) / (55 * u * u)), steps = rng.int(30, 70), step = u * 1.1;
  for (let i = 0; i < n; i++) {
    let x = rng.next() * w, y = rng.next() * h;
    ctx.strokeStyle = css(colorAt(pal, 0.3 + 0.7 * noise(ox + (x / m) * sc, oy + (y / m) * sc, 3)), 0.3);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const a = noise(ox + (x / m) * sc, oy + (y / m) * sc, 3) * Math.PI * turn;
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* 16 ─ Plasma: interfering sine waves, smooth or posterised */
function plasma(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), f = [0, 1, 2, 3].map(() => (rng.range(2, 6) * Math.PI * 2) / m);
  const ph = [0, 1, 2, 3].map(() => rng.range(0, Math.PI * 2));
  const cx = w * rng.range(0.2, 0.8), cy = h * rng.range(0.2, 0.8), q = rng.chance(0.5) ? rng.int(5, 10) : 0;
  pixelField(ctx, w, h, (x, y) => {
    const v = Math.sin(x * f[0] + ph[0]) + Math.sin(y * f[1] + ph[1]) + Math.sin((x + y) * f[2] + ph[2]) + Math.sin(Math.hypot(x - cx, y - cy) * f[3] + ph[3]);
    let t = (v + 4) / 8;
    if (q) t = Math.floor(t * q) / (q - 1);
    return colorAt(pal, clamp(t, 0, 1));
  });
}

/* 17 ─ Forest: misty rows of pines receding into fog */
function forest(ctx, w, h, rng, pal) {
  const m = Math.min(w, h);
  const top = colorAt(pal, rng.range(0.55, 0.75)), bot = colorAt(pal, rng.range(0.82, 0.98));
  drawBands(ctx, w, h, top, bot, h, clamp(Math.round(h / 14), 8, 48));
  if (rng.chance(0.7)) {
    const sun = colorAt(pal, 1), r = Math.round(m * rng.range(0.06, 0.1));
    const cx = Math.round(w * rng.range(0.15, 0.85)), cy = Math.round(h * rng.range(0.15, 0.35));
    for (let k = 3; k >= 1; k--) fillEllipse(ctx, cx, cy, r * (1 + 0.5 * k), r * (1 + 0.5 * k), mix(mix(top, bot, cy / h), sun, 0.1 * (4 - k)));
    fillEllipse(ctx, cx, cy, r, r, sun);
  }
  const dark = colorAt(pal, 0), fog = bot, L = rng.int(5, 7);
  for (let l = 0; l < L; l++) {
    const t = L === 1 ? 1 : l / (L - 1), base = lerp(h * 0.42, h * 0.9, t), ts = lerp(m * 0.06, m * 0.2, t);
    const col = mix(mix(fog, dark, 0.35), dark, Math.pow(t, 0.8));
    ctx.fillStyle = css(col); ctx.fillRect(0, base + ts * 0.4, w, h);
    for (let x = -ts; x < w + ts; x += ts * 0.42 * rng.range(0.6, 1.5)) {
      const sz = ts * rng.range(0.7, 1.25), y = base + rng.range(-0.25, 0.25) * ts;
      for (let k = 0; k < 3; k++) {
        const topY = y - sz * (1 - k * 0.3), half = sz * 0.2 * (1 + k * 0.55), baseY = topY + sz * 0.5;
        poly(ctx, [[x, topY], [x + half, baseY], [x - half, baseY]], col);
      }
    }
    if (l < L - 1) {
      const fg = ctx.createLinearGradient(0, base - ts * 1.2, 0, base + ts * 1.6);
      fg.addColorStop(0, css(fog, 0)); fg.addColorStop(0.55, css(fog, 0.5)); fg.addColorStop(1, css(fog, 0));
      ctx.fillStyle = fg; ctx.fillRect(0, base - ts * 1.2, w, ts * 2.8);
    }
  }
}

/* 18 ─ Hex: honeycomb mosaic coloured by a noise field */
function hex(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), s = m / rng.range(6, 13), noise = makeNoise2D(rng);
  const ox = rng.range(0, 50), oy = rng.range(0, 50), sc = rng.range(1, 2.5), q = rng.int(4, 8);
  ctx.fillStyle = css(colorAt(pal, 0.02)); ctx.fillRect(0, 0, w, h);
  const dx = Math.sqrt(3) * s, dy = 1.5 * s, light = colorAt(pal, 1);
  const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), cy + r * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
  for (let row = -1; row * dy < h + s; row++) {
    for (let col = -1; col * dx < w + dx; col++) {
      const cx = col * dx + (row & 1 ? dx / 2 : 0), cy = row * dy;
      const v = noise(ox + (cx / m) * sc, oy + (cy / m) * sc, 3);
      const tier = Math.floor(clamp((v - 0.25) / 0.5, 0, 0.999) * q) / (q - 1);
      const base = colorAt(pal, 0.1 + 0.9 * tier);
      poly(ctx, hexPts(cx, cy, s * 0.94), base);
      if (rng.chance(0.35)) poly(ctx, hexPts(cx, cy, s * 0.6), mix(base, light, 0.25));
    }
  }
}

/* 19 ─ Planet: shaded world, optional ring, starry sky */
function planet(ctx, w, h, rng, pal) {
  const m = Math.min(w, h), noise = makeNoise2D(rng);
  drawBands(ctx, w, h, colorAt(pal, 0), colorAt(pal, 0.12), h, clamp(Math.round(h / 14), 8, 48));
  scatterStars(ctx, w, h, rng, colorAt(pal, 1), colorAt(pal, 0.05), h, 650);
  const R = Math.round(m * rng.range(0.24, 0.38)), cx = Math.round(w * rng.range(0.3, 0.7)), cy = Math.round(h * rng.range(0.42, 0.62));
  const ring = rng.chance(0.55), tilt = rng.range(-0.5, 0.5), ringCol = colorAt(pal, rng.range(0.55, 0.9));
  const banded = rng.chance(0.5), bands = rng.range(4, 9), ox = rng.range(0, 50), la = rng.range(0, Math.PI * 2);
  const lx = Math.cos(la) * 0.8, ly = Math.sin(la) * 0.8, lz = 0.55, ll = Math.hypot(lx, ly, lz);
  const atmos = colorAt(pal, 0.85), dark = colorAt(pal, 0);
  const drawRing = (front) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(1, 0.26);
    ctx.lineWidth = R * 0.3; ctx.strokeStyle = css(ringCol, 0.75);
    ctx.beginPath(); ctx.arc(0, 0, R * 1.7, 0, front ? Math.PI : Math.PI * 2); ctx.stroke();
    ctx.restore();
  };
  if (ring) drawRing(false);
  const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.4);
  glow.addColorStop(0, css(atmos, 0.35)); glow.addColorStop(1, css(atmos, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  const bx0 = Math.max(0, cx - R), by0 = Math.max(0, cy - R), bx1 = Math.min(w - 1, cx + R), by1 = Math.min(h - 1, cy + R);
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  if (bw > 0 && bh > 0) {
    const img = ctx.getImageData(bx0, by0, bw, bh), d = img.data;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = (x - cx) / R, py = (y - cy) / R, r2 = px * px + py * py;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), lam = Math.max(0, (px * lx + py * ly + nz * lz) / ll);
      const lon = Math.atan2(px, nz), lat = Math.asin(py);
      const tex = banded ? noise(ox + lon * 0.8, lat * bands, 4) : noise(ox + lon * 2.2, lat * 2.2, 5);
      const tcol = colorAt(pal, 0.2 + 0.75 * clamp((tex - 0.25) / 0.5, 0, 1));
      const shade = 0.08 + 0.92 * Math.pow(lam, 0.9), rim = Math.pow(1 - nz, 3) * 0.3;
      const c = mix(mix(dark, tcol, shade), atmos, rim);
      const i = ((y - by0) * bw + (x - bx0)) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, bx0, by0);
  }
  if (ring) drawRing(true);
}

const STYLES = {
  horizon:   { name: 'Horizon',   sub: 'pixel landscape', draw: horizon },
  aurora:    { name: 'Aurora',    sub: 'glowing sky',     draw: aurora },
  mosaic:    { name: 'Mosaic',    sub: 'tiled sprites',   draw: mosaic },
  waves:     { name: 'Waves',     sub: 'layered ridges',  draw: waves },
  geometric: { name: 'Geometric', sub: 'bauhaus tiles',   draw: geometric },
  automata:  { name: 'Automata',  sub: 'cellular rules',  draw: automata },
  cubes:     { name: 'Cubes',     sub: 'isometric blocks', draw: cubes },
  topo:      { name: 'Topo',      sub: 'contour map',     draw: topo },
  truchet:   { name: 'Truchet',   sub: 'arc ribbons',     draw: truchet },
  cosmos:    { name: 'Cosmos',    sub: 'nebula & stars',  draw: cosmos },
  stained:   { name: 'Stained',   sub: 'glass cells',     draw: stained },
  rays:      { name: 'Rays',      sub: 'retro sunburst',  draw: rays },
  skyline:   { name: 'Skyline',   sub: 'night city',      draw: skyline },
  spiro:     { name: 'Spiro',     sub: 'glowing curves',  draw: spiro },
  flow:      { name: 'Flow',      sub: 'noise streams',   draw: flow },
  plasma:    { name: 'Plasma',    sub: 'sine interference', draw: plasma },
  forest:    { name: 'Forest',    sub: 'misty pines',     draw: forest },
  hex:       { name: 'Hex',       sub: 'honeycomb',       draw: hex },
  planet:    { name: 'Planet',    sub: 'ringed world',    draw: planet },
};
const STYLE_KEYS = Object.keys(STYLES);

/* ───────────────────────── Post effects ───────────────────────── */
function applyVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function applyGrain(ctx, w, h, rng) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.next() - 0.5) * 16;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}


/* ───────────────────────── Options, sizes, rendering ───────────────────────── */
const RES = [
  ['1920x1080', 'Desktop HD — 1920×1080'],
  ['2560x1440', 'QHD — 2560×1440'],
  ['3840x2160', '4K — 3840×2160'],
  ['3440x1440', 'Ultrawide — 3440×1440'],
  ['2880x1800', 'MacBook — 2880×1800'],
  ['1170x2532', 'Phone (iPhone) — 1170×2532'],
  ['1080x2400', 'Phone (Android) — 1080×2400'],
  ['2000x2000', 'Square — 2000×2000'],
  ['custom',    'Custom…'],
];
const ADJ = ['quiet','golden','lazy','neon','misty','brave','sleepy','cosmic','velvet','electric','tiny','wild','amber','frozen','hollow','lucky','silver','dusty','gentle','crimson','lunar','mellow','rusty','sunny','wandering'];
const NOUN = ['fox','harbor','comet','meadow','lantern','canyon','otter','glacier','orchard','falcon','reef','summit','willow','ember','pebble','tundra','cedar','nebula','island','breeze','compass','mirage','thistle','voyage','monsoon'];
const randomSeed = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]}-${NOUN[Math.floor(Math.random() * NOUN.length)]}-${100 + Math.floor(Math.random() * 900)}`;

const getRes = (st) => {
  if (st.res === 'custom') return { W: st.cw, H: st.ch };
  const [W, H] = st.res.split('x').map(Number);
  return { W, H };
};
/* px = 1 means native resolution; higher values scale with the output size so the look stays consistent. */
const gridPx = (st, W, H) => (st.px <= 1 ? 1 : Math.max(1, Math.round((st.px * Math.min(W, H)) / 1080)));

/**
 * Draw the low-resolution "design grid" for a state.
 * createCanvas(w, h) must return a canvas supporting getContext('2d').
 */
function generate(st, createCanvas) {
  const { W, H } = getRes(st);
  const px = gridPx(st, W, H);
  const lw = Math.ceil(W / px), lh = Math.ceil(H / px);
  const cv = createCanvas(lw, lh);
  const ctx = cv.getContext('2d');
  const rng = makeRng(`${st.seed}|${st.style}|v${VERSION}`);
  STYLES[st.style].draw(ctx, lw, lh, rng, getPalette(st));
  if (st.vig) applyVignette(ctx, lw, lh);
  if (st.grain) applyGrain(ctx, lw, lh, makeRng(`${st.seed}|grain|v${VERSION}`));
  return { cv, W, H, px, lw, lh };
}
/** Scale a generated grid up (nearest-neighbour) into a target canvas of W×H. */
function present(gen, target) {
  target.width = gen.W; target.height = gen.H;
  const ctx = target.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(gen.cv, 0, 0, gen.lw * gen.px, gen.lh * gen.px);
  return target;
}
/** Convenience for Node: returns a finished W×H canvas. */
function render(st, createCanvas) {
  const gen = generate(st, createCanvas);
  return present(gen, createCanvas(gen.W, gen.H));
}

const DEFAULTS = { seed: 'seedscape', style: 'horizon', pal: 'auto', res: 'custom', cw: 1920, ch: 1080, px: 4, grain: true, vig: true, invert: false };

/**
 * Validate and normalise loose input (e.g. URL query params) into a state object.
 * Throws an Error with a human-readable message on invalid input.
 * limits: { maxDim, maxPixels }
 */
function normalize(input, limits) {
  const lim = Object.assign({ maxDim: 7680, maxPixels: 7680 * 4320, minDim: 64 }, limits);
  const st = Object.assign({}, DEFAULTS);
  const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
  const int = (v, name, lo, hi, d) => {
    if (v === undefined || v === '') return d;
    const n = Number(v);
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`"${name}" must be an integer between ${lo} and ${hi}`);
    return n;
  };
  if (input.seed !== undefined && String(input.seed).length) st.seed = String(input.seed);
  if (st.seed.length > 200) throw new Error('"seed" must be at most 200 characters');
  if (input.style !== undefined && input.style !== '') {
    if (!STYLES[input.style]) throw new Error(`"style" must be one of: ${Object.keys(STYLES).join(', ')}`);
    st.style = input.style;
  }
  if (input.palette !== undefined && input.palette !== '' && String(input.palette).toLowerCase() !== 'auto') {
    const name = Object.keys(PALETTES).find((n) => n.toLowerCase().replace(/\s+/g, '-') === String(input.palette).toLowerCase().replace(/\s+/g, '-'));
    if (!name) throw new Error(`"palette" must be "auto" or one of: ${Object.keys(PALETTES).map((n) => n.toLowerCase().replace(/\s+/g, '-')).join(', ')}`);
    st.pal = name;
  }
  st.cw = int(input.w, 'w', lim.minDim, lim.maxDim, st.cw);
  st.ch = int(input.h, 'h', lim.minDim, lim.maxDim, st.ch);
  if (st.cw * st.ch > lim.maxPixels) throw new Error(`Image too large: w × h must not exceed ${lim.maxPixels} pixels`);
  st.px = int(input.px, 'px', 1, 16, st.px);
  st.grain = bool(input.grain, st.grain);
  st.vig = bool(input.vignette, st.vig);
  st.invert = bool(input.invert, st.invert);
  return st;
}

return {
  VERSION, STYLES, PALETTES, RES, DEFAULTS,
  makeRng, getPalette, getRes, gridPx, generate, present, render, normalize, randomSeed,
  helpers: { css, mix, hexToRgb, clamp },
};
});
