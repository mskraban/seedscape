'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const Seedscape = require('../public/engine.js');
const { renderFromQuery, describe } = require('../lib/render');

const styles = Object.keys(Seedscape.STYLES);

test('every style is deterministic for a given seed', () => {
  for (const style of styles) {
    const st = Seedscape.normalize({ seed: 'hello', style, w: 320, h: 180 });
    const a = Seedscape.render(st, createCanvas).toBuffer('image/png');
    const b = Seedscape.render(st, createCanvas).toBuffer('image/png');
    assert.ok(a.equals(b), `${style} differs between runs`);
  }
});

test('different seeds produce different images', () => {
  for (const style of styles) {
    const a = Seedscape.render(Seedscape.normalize({ seed: 'one', style, w: 320, h: 180 }), createCanvas).toBuffer('image/png');
    const b = Seedscape.render(Seedscape.normalize({ seed: 'two', style, w: 320, h: 180 }), createCanvas).toBuffer('image/png');
    assert.ok(!a.equals(b), `${style} ignores the seed`);
  }
});

test('output has the requested dimensions', () => {
  const c = Seedscape.render(Seedscape.normalize({ seed: 'x', w: 640, h: 360 }), createCanvas);
  assert.equal(c.width, 640);
  assert.equal(c.height, 360);
});

test('normalize rejects bad input with readable messages', () => {
  assert.throws(() => Seedscape.normalize({ style: 'nope' }), /"style" must be one of/);
  assert.throws(() => Seedscape.normalize({ w: '10' }), /"w" must be an integer/);
  assert.throws(() => Seedscape.normalize({ px: '99' }), /"px"/);
  assert.throws(() => Seedscape.normalize({ palette: 'rainbow' }), /"palette"/);
});

test('palette names accept slugs', () => {
  assert.equal(Seedscape.normalize({ palette: 'game-boy' }).pal, 'Game Boy');
  assert.equal(Seedscape.normalize({ palette: 'AUTO' }).pal, 'auto');
});

test('API renders png / jpeg / webp and enforces limits', async () => {
  for (const format of ['png', 'jpeg', 'webp']) {
    const r = await renderFromQuery({ seed: 'api', size: '400x300', format });
    assert.ok(r.buffer.length > 500);
    assert.equal(r.deterministic, true);
  }
  await assert.rejects(renderFromQuery({ w: '5000', h: '100' }), /"w" must be/);
  await assert.rejects(renderFromQuery({ w: '4096', h: '4096' }), /too large/);
  await assert.rejects(renderFromQuery({ format: 'gif' }), /"format"/);
  const random = await renderFromQuery({ size: '200x200' });
  assert.equal(random.deterministic, false);
});

test('describe() lists styles, palettes and limits', () => {
  const d = describe();
  assert.equal(d.styles.length, Object.keys(Seedscape.STYLES).length);
  assert.ok(d.styles.length >= 35);
  assert.ok(d.palettes.some((p) => p.id === 'game-boy'));
  assert.ok(d.limits.maxDim > 0);
});

test('every style renders at odd sizes and extreme pixel sizes without throwing', () => {
  for (const style of styles) {
    for (const [w, h] of [[64, 64], [100, 400], [333, 177]]) {
      for (const px of ['1', '16']) {
        const c = Seedscape.render(Seedscape.normalize({ seed: `edge-${style}`, style, w: String(w), h: String(h), px }), createCanvas);
        assert.equal(c.width, w);
        assert.equal(c.height, h);
      }
    }
  }
});

test('stills never change: every style matches its frozen signature', () => {
  // Guards the promise "same seed, same art". If this fails on purpose, bump VERSION in the engine.
  const crypto = require('node:crypto');
  const sig = (style) => crypto.createHash('sha1').update(
    Seedscape.render(Seedscape.normalize({ seed: 'golden-fox-212', style, w: 320, h: 180, palette: 'dusk' }), createCanvas).toBuffer('image/png')
  ).digest('hex').slice(0, 12);
  const want = require('./fixtures/signatures.json');
  for (const style of Object.keys(want)) assert.equal(sig(style), want[style], `${style} changed`);
  assert.ok(Object.keys(want).length >= 35);
});

test('blur: off by default, deterministic, validated, and actually softens', () => {
  const crypto = require('node:crypto');
  const sig = (o) => crypto.createHash('sha1').update(
    Seedscape.render(Seedscape.normalize({ seed: 'blur', style: 'geometric', w: 320, h: 180, ...o }), createCanvas).toBuffer('image/png')
  ).digest('hex');
  assert.equal(sig({}), sig({ blur: '0' }));
  assert.equal(sig({ blur: '12' }), sig({ blur: '12' }));
  assert.notEqual(sig({}), sig({ blur: '12' }));
  assert.notEqual(sig({ blur: '5' }), sig({ blur: '25' }));
  assert.throws(() => Seedscape.normalize({ blur: '31' }), /"blur"/);
  assert.throws(() => Seedscape.normalize({ blur: '-1' }), /"blur"/);
});

/* ───────────── Animation ───────────── */
const meanDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4) / 3; };
const frame = (style, t) => Seedscape.render(Seedscape.normalize({ seed: 'anim-test', style, w: 240, h: 135, grain: '0' }), createCanvas, t).getContext('2d').getImageData(0, 0, 240, 135).data;

test('animation: every style moves over time and is deterministic', () => {
  for (const style of styles) {
    const a = frame(style, 0), b = frame(style, 0.5), a2 = frame(style, 0);
    assert.equal(meanDiff(a, a2), 0, `${style} is not deterministic per frame`);
    assert.ok(meanDiff(a, b) > 0.05, `${style} does not move`);
  }
});

test('animation: loops are seamless (t=1 is t=0, and the wrap step is an ordinary step)', () => {
  for (const style of styles) {
    assert.equal(meanDiff(frame(style, 0), frame(style, 1)), 0, `${style}: t=1 differs from t=0`);
    if (style === 'glitch') continue; // glitch deliberately jumps between 12 states per loop
    const step = meanDiff(frame(style, 0.5), frame(style, 0.52)), wrap = meanDiff(frame(style, 0.98), frame(style, 1));
    assert.ok(wrap <= Math.max(3 * step, 2.5), `${style}: loop seam is visible (wrap ${wrap.toFixed(2)} vs step ${step.toFixed(2)})`);
  }
});

test('animation: omitting time still gives the unchanged still image', () => {
  const st = Seedscape.normalize({ seed: 'still', style: 'horizon', w: 200, h: 120 });
  assert.ok(Seedscape.render(st, createCanvas).toBuffer('image/png').equals(Seedscape.render(st, createCanvas, undefined).toBuffer('image/png')));
});

test('animation API: animated webp and gif, validation and budget', async () => {
  const sharp = require('sharp');
  for (const format of ['webp', 'gif']) {
    const r = await renderFromQuery({ seed: 'anim', animate: '1', size: '200x120', frames: '4', fps: '8', format });
    const meta = await sharp(r.buffer, { animated: true }).metadata();
    assert.equal(meta.pages, 4);
    assert.equal(r.mime, `image/${format}`);
    assert.equal(r.deterministic, true);
  }
  await assert.rejects(renderFromQuery({ animate: '1', format: 'png' }), /animated "format"/);
  await assert.rejects(renderFromQuery({ animate: '1', frames: '3' }), /"frames"/);
  await assert.rejects(renderFromQuery({ animate: '1', fps: '31' }), /"fps"/);
  await assert.rejects(renderFromQuery({ animate: '1', size: '1920x1080' }), /too large/);
  await assert.rejects(renderFromQuery({ animate: '1', frames: '48', size: '1280x780' }), /megapixels/);
  assert.equal(describe().animation.enabled, true);
});
