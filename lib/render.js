'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const sharp = require('sharp');
const Seedscape = require('../public/engine.js');

/** Hard limits that keep a serverless render fast and cheap. */
const LIMITS = { minDim: 64, maxDim: 4096, maxPixels: 8_500_000 };
const FORMATS = {
  png:  { mime: 'image/png',  encode: (c) => c.encode('png') },
  jpeg: { mime: 'image/jpeg', encode: (c, q) => c.encode('jpeg', q) },
  webp: { mime: 'image/webp', encode: (c, q) => c.encode('webp', q) },
};

/** Animated output is capped much harder: every frame is a full render plus an encode. */
const ANIM = {
  frames: { def: 24, min: 4, max: 48 },
  fps: { def: 12, min: 1, max: 30 },
  maxPixels: 1_000_000,
  maxFramePixels: 13_000_000, // frames × width × height: bounds memory (raw frames) and encode time
  defaultSize: [960, 540],
  formats: ['webp', 'gif'],
};
const truthy = (v) => v !== undefined && ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
const first = (v) => (Array.isArray(v) ? v[0] : v);

/**
 * Turn raw query params into an encoded image.
 * Returns { buffer, mime, state, deterministic }. Throws Error (message safe to show) on bad input.
 */
async function renderFromQuery(query) {
  const q = {};
  for (const k of Object.keys(query || {})) q[k] = first(query[k]);
  if (truthy(q.animate)) return renderAnimation(q);

  const format = String(q.format || 'png').toLowerCase().replace('jpg', 'jpeg');
  if (!FORMATS[format]) throw new Error(`"format" must be one of: ${Object.keys(FORMATS).join(', ')}`);

  let quality = 90;
  if (q.quality !== undefined && q.quality !== '') {
    quality = Number(q.quality);
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error('"quality" must be an integer between 1 and 100');
  }

  // Sensible default size, and a friendly "size=WxH" shorthand.
  if (q.size && !q.w && !q.h) {
    const m = /^(\d+)x(\d+)$/i.exec(String(q.size));
    if (!m) throw new Error('"size" must look like 1920x1080');
    q.w = m[1]; q.h = m[2];
  }

  const deterministic = q.seed !== undefined && q.seed !== '';
  if (!deterministic) q.seed = Seedscape.randomSeed();

  const state = Seedscape.normalize(q, LIMITS);
  const canvas = Seedscape.render(state, createCanvas);
  const buffer = await FORMATS[format].encode(canvas, quality);
  return { buffer, mime: FORMATS[format].mime, state, deterministic, format };
}

/**
 * Render a seamlessly looping animation as animated WebP or GIF.
 * Frame i is drawn at loop time i / frames, so the last frame flows straight back into the first.
 */
async function renderAnimation(q) {
  const format = String(q.format || 'webp').toLowerCase();
  if (!ANIM.formats.includes(format)) throw new Error(`animated "format" must be one of: ${ANIM.formats.join(', ')}`);
  const int = (v, name, { min, max, def }) => {
    if (v === undefined || v === '') return def;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`"${name}" must be an integer between ${min} and ${max}`);
    return n;
  };
  const frames = int(q.frames, 'frames', ANIM.frames), fps = int(q.fps, 'fps', ANIM.fps);
  let quality = 80;
  if (q.quality !== undefined && q.quality !== '') {
    quality = Number(q.quality);
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error('"quality" must be an integer between 1 and 100');
  }
  const input = Object.assign({}, q);
  if (input.size && !input.w && !input.h) {
    const m = /^(\d+)x(\d+)$/i.exec(String(input.size));
    if (!m) throw new Error('"size" must look like 960x540');
    input.w = m[1]; input.h = m[2];
  }
  if (!input.w && !input.h) { input.w = String(ANIM.defaultSize[0]); input.h = String(ANIM.defaultSize[1]); }
  if (input.grain === undefined) input.grain = '0'; // fresh grain every frame bloats the file
  const deterministic = input.seed !== undefined && input.seed !== '';
  if (!deterministic) input.seed = Seedscape.randomSeed();

  const state = Seedscape.normalize(input, Object.assign({}, LIMITS, { maxPixels: ANIM.maxPixels }));
  const W = state.cw, H = state.ch, bufs = [];
  if (frames * W * H > ANIM.maxFramePixels) throw new Error(`frames × width × height must not exceed ${ANIM.maxFramePixels / 1e6} megapixels in total (the default is ${ANIM.frames.def} frames at ${ANIM.defaultSize.join('×')}); use fewer frames or a smaller size`);
  for (let i = 0; i < frames; i++) {
    const canvas = Seedscape.render(state, createCanvas, i / frames);
    const px = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    bufs.push(Buffer.from(px.buffer, px.byteOffset, px.byteLength));
  }
  const img = sharp(Buffer.concat(bufs), { raw: { width: W, height: H * frames, channels: 4, pageHeight: H } });
  const delay = Array(frames).fill(Math.round(1000 / fps));
  const buffer = await (format === 'gif'
    ? img.gif({ loop: 0, delay, effort: 3 })
    : img.webp({ loop: 0, delay, quality, effort: 2 })).toBuffer();
  return { buffer, mime: `image/${format}`, state, deterministic, format, frames, fps, animated: true };
}

/** Machine-readable description of everything the API supports. */
function describe() {
  const slug = (n) => n.toLowerCase().replace(/\s+/g, '-');
  return {
    name: 'Seedscape',
    version: '1.0.0',
    engineVersion: Seedscape.VERSION,
    limits: LIMITS,
    styles: Object.entries(Seedscape.STYLES).map(([id, s]) => ({ id, name: s.name, description: s.sub, category: s.cat })),
    categories: Object.entries(Seedscape.CATEGORIES).map(([id, c]) => ({ id, name: c.name })),
    palettes: [{ id: 'auto', name: 'Auto', colors: null }].concat(
      Object.entries(Seedscape.PALETTES).map(([name, colors]) => ({ id: slug(name), name, colors }))
    ),
    sizes: Seedscape.RES.filter(([v]) => v !== 'custom').map(([v, label]) => ({ size: v, label })),
    formats: Object.keys(FORMATS),
    animation: { enabled: true, param: 'animate=1', frames: ANIM.frames, fps: ANIM.fps, formats: ANIM.formats, defaultSize: `${ANIM.defaultSize[0]}x${ANIM.defaultSize[1]}`, maxPixels: ANIM.maxPixels, maxFramePixels: ANIM.maxFramePixels, note: 'Seamless loop; grain is off by default for animations.' },
    defaults: { style: 'horizon', palette: 'auto', size: '1920x1080', px: 4, blur: 0, grain: true, vignette: true, invert: false, format: 'png', quality: 90 },
  };
}

module.exports = { renderFromQuery, describe, LIMITS, Seedscape };
