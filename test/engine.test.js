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
  assert.equal(d.styles.length, 6);
  assert.ok(d.palettes.some((p) => p.id === 'game-boy'));
  assert.ok(d.limits.maxDim > 0);
});
