'use strict';
// SEO and site-integrity checks: these protect search ranking, link previews and basic accessibility.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PUB = path.join(__dirname, '..', 'public');
const SITE = 'https://seedscape-azure.vercel.app';
const pages = { 'index.html': '/', 'app.html': '/app', 'docs.html': '/docs', 'live.html': '/live' };
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const meta = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

for (const [file, route] of Object.entries(pages)) {
  test(`${file}: title, description, canonical, social tags and a single h1`, () => {
    const html = read(file);
    const title = meta(html, /<title>([^<]+)<\/title>/);
    assert.ok(title && title.length >= 20 && title.length <= 75, `title length ${title && title.length}`);
    const desc = meta(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(desc && desc.length >= 70 && desc.length <= 170, `description length ${desc && desc.length}`);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), SITE + (route === '/' ? '/' : route));
    for (const tag of ['og:title', 'og:description', 'og:url', 'og:image']) assert.ok(html.includes(`property="${tag}"`), `missing ${tag}`);
    assert.ok(html.includes('name="twitter:card"') && html.includes('name="twitter:image"'));
    assert.ok(html.includes('name="theme-color"') && html.includes('rel="manifest"') && html.includes('rel="apple-touch-icon"'));
    assert.match(html, /<html lang="en">/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one <h1>');
  });

  test(`${file}: structured data parses as JSON and local files exist`, () => {
    const html = read(file);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    for (const m of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|data:|\/\/)/.test(u) || /\$\{/.test(u) || /^\/?(api|w|random)(\/|$)/.test(u)) continue;
      const clean = u.replace(/^\//, '');
      const ok = clean === '' || fs.existsSync(path.join(PUB, clean)) || fs.existsSync(path.join(PUB, clean + '.html')) || ['sitemap.xml'].includes(clean);
      assert.ok(ok, `${file} links to a missing file: ${u}`);
    }
  });
}

test('homepage FAQ structured data matches the visible FAQ', () => {
  const html = read('index.html');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find((x) => x['@type'] === 'FAQPage');
  const visible = [...html.matchAll(/<details class="faq"><summary>([^<]+)<\/summary>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.deepEqual(ld.mainEntity.map((q) => q.name), visible);
});

test('sitemap lists exactly the public pages and robots.txt points to it', () => {
  const sm = read('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs.sort(), Object.values(pages).map((r) => SITE + (r === '/' ? '/' : r)).sort());
  assert.ok(read('robots.txt').includes(`Sitemap: ${SITE}/sitemap.xml`));
});

test('manifest, icons, social image and fonts exist', () => {
  const mf = JSON.parse(read('manifest.webmanifest'));
  for (const i of mf.icons) assert.ok(fs.existsSync(path.join(PUB, i.src.replace(/^\//, ''))), `icon ${i.src}`);
  const og = fs.readFileSync(path.join(PUB, 'og.png'));
  assert.equal(og.readUInt32BE(16), 1200); assert.equal(og.readUInt32BE(20), 630);
  const css = read('fonts.css');
  for (const m of css.matchAll(/url\('([^']+\.woff2)'\)/g)) assert.ok(fs.existsSync(path.join(PUB, m[1])), m[1]);
  for (const f of ['inter', 'bricolage-grotesque', 'jetbrains-mono']) assert.ok(fs.existsSync(path.join(PUB, `fonts/${f}-LICENSE.txt`)), `${f} license`);
});

test('docs.html is up to date with the engine (run `npm run docs` if this fails)', () => {
  const tmp = path.join(os.tmpdir(), `docs-${process.pid}.html`);
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-docs.js')], { env: { ...process.env, DOCS_OUT: tmp } });
  assert.equal(fs.readFileSync(tmp, 'utf8'), read('docs.html'));
  fs.unlinkSync(tmp);
});

test('every style has a category and a homepage preview pick', () => {
  const E = require('../public/engine.js');
  const home = read('index.html');
  for (const [id, s] of Object.entries(E.STYLES)) {
    assert.ok(s.cat, `${id} has no category`);
    assert.ok(new RegExp(`\\b${id}: \\['`).test(home), `${id} missing from homepage PICKS`);
  }
});
