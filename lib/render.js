'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const Seedscape = require('../public/engine.js');

/** Hard limits that keep a serverless render fast and cheap. */
const LIMITS = { minDim: 64, maxDim: 4096, maxPixels: 8_500_000 };
const FORMATS = {
  png:  { mime: 'image/png',  encode: (c) => c.encode('png') },
  jpeg: { mime: 'image/jpeg', encode: (c, q) => c.encode('jpeg', q) },
  webp: { mime: 'image/webp', encode: (c, q) => c.encode('webp', q) },
};

const first = (v) => (Array.isArray(v) ? v[0] : v);

/**
 * Turn raw query params into an encoded image.
 * Returns { buffer, mime, state, deterministic }. Throws Error (message safe to show) on bad input.
 */
async function renderFromQuery(query) {
  const q = {};
  for (const k of Object.keys(query || {})) q[k] = first(query[k]);

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

/** Machine-readable description of everything the API supports. */
function describe() {
  const slug = (n) => n.toLowerCase().replace(/\s+/g, '-');
  return {
    name: 'Seedscape',
    version: '1.0.0',
    engineVersion: Seedscape.VERSION,
    limits: LIMITS,
    styles: Object.entries(Seedscape.STYLES).map(([id, s]) => ({ id, name: s.name, description: s.sub })),
    palettes: [{ id: 'auto', name: 'Auto', colors: null }].concat(
      Object.entries(Seedscape.PALETTES).map(([name, colors]) => ({ id: slug(name), name, colors }))
    ),
    sizes: Seedscape.RES.filter(([v]) => v !== 'custom').map(([v, label]) => ({ size: v, label })),
    formats: Object.keys(FORMATS),
    defaults: { style: 'horizon', palette: 'auto', size: '1920x1080', px: 4, blur: 0, grain: true, vignette: true, invert: false, format: 'png', quality: 90 },
  };
}

module.exports = { renderFromQuery, describe, LIMITS, Seedscape };
