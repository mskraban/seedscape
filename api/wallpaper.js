'use strict';
const { renderFromQuery } = require('../lib/render');

/** Vercel functions cap response bodies at 4.5 MB; stay safely below it. */
const MAX_BODY = 4.4 * 1024 * 1024;

/**
 * GET /api/wallpaper
 * Renders a wallpaper. Same query => same image, so responses with a seed are cached forever.
 * See README for the parameter list.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    return res.end('Method Not Allowed');
  }
  try {
    const { buffer, mime, state, deterministic, format, animated, frames, fps } = await renderFromQuery(req.query);
    if (buffer.length > MAX_BODY) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({
        error: `Rendered image is ${(buffer.length / 1e6).toFixed(1)} MB, above the ${(MAX_BODY / 1e6).toFixed(1)} MB response limit`,
        hint: animated
          ? 'Use fewer frames, a smaller size, format=webp, or keep grain=0.'
          : 'Use format=webp or format=jpeg, raise px, set grain=0, or request a smaller size.',
      }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Seedscape-Seed', encodeURIComponent(state.seed));
    res.setHeader('X-Seedscape-Engine', '1');
    if (animated) { res.setHeader('X-Seedscape-Frames', String(frames)); res.setHeader('X-Seedscape-Fps', String(fps)); }
    res.setHeader('Cache-Control', deterministic
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'no-store');
    if (req.query.download !== undefined && req.query.download !== '0') {
      const safe = state.seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'seed';
      res.setHeader('Content-Disposition', `attachment; filename="seedscape-${safe}-${state.style}-${state.cw}x${state.ch}.${format === 'jpeg' ? 'jpg' : format}"`);
    }
    res.setHeader('Content-Length', buffer.length);
    return res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ error: err.message, hint: 'GET /api/styles lists every valid option.' }));
  }
};
