'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wallpaper = require('../api/wallpaper');
const random = require('../api/random');
const styles = require('../api/styles');

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b; res.done = true; };
  return res;
}

test('GET /api/wallpaper returns a cacheable PNG for a seed', async () => {
  const res = mockRes();
  await wallpaper({ method: 'GET', query: { seed: 'abc', size: '320x180' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/png');
  assert.match(res.headers['cache-control'], /immutable/);
  assert.equal(res.headers['x-seedscape-seed'], 'abc');
  assert.equal(res.body.subarray(1, 4).toString(), 'PNG');
});

test('GET /api/wallpaper without a seed is random and uncached', async () => {
  const res = mockRes();
  await wallpaper({ method: 'GET', query: { size: '200x120' } }, res);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.ok(res.headers['x-seedscape-seed']);
});

test('bad input returns 400 JSON', async () => {
  const res = mockRes();
  await wallpaper({ method: 'GET', query: { style: 'nope' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /style/);
});

test('download param sets a filename', async () => {
  const res = mockRes();
  await wallpaper({ method: 'GET', query: { seed: 'My Seed!', size: '200x120', download: '1', format: 'jpg' } }, res);
  assert.match(res.headers['content-disposition'], /seedscape-my-seed-horizon-200x120\.jpg/);
});

test('non-GET methods are rejected, OPTIONS is allowed', async () => {
  let res = mockRes(); await wallpaper({ method: 'POST', query: {} }, res); assert.equal(res.statusCode, 405);
  res = mockRes(); await wallpaper({ method: 'OPTIONS', query: {} }, res); assert.equal(res.statusCode, 204);
});

test('GET /api/random and /api/styles return JSON', () => {
  let res = mockRes(); random({ query: {}, headers: { host: 'example.com' } }, res);
  const r = JSON.parse(res.body);
  assert.ok(r.seed && r.url.startsWith('https://example.com/api/wallpaper?'));
  res = mockRes(); random({ query: { redirect: '1' }, headers: {} }, res);
  assert.equal(res.statusCode, 302);
  res = mockRes(); styles({ query: {} }, res);
  assert.ok(JSON.parse(res.body).styles.length >= 35);
});
