'use strict';
// Builds public/docs.html from the engine and API metadata, so the docs can never drift. Run: npm run docs
const fs = require('fs');
const path = require('path');
const { describe, LIMITS } = require('../lib/render');
const E = require('../public/engine.js');

const SITE = 'https://seedscape-azure.vercel.app';
const d = describe();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const params = [
  ['seed', 'random', 'Any text, up to 200 characters. <b>Leave it out for a random image</b> (not cached).'],
  ['style', 'horizon', `One of the ${d.styles.length} <a href="#styles">styles</a>.`],
  ['palette', 'auto', '<code>auto</code> (derived from the seed) or a <a href="#palettes">palette id</a>.'],
  ['size', '1920x1080', 'Shorthand <code>WxH</code>. Or use <code>w</code> and <code>h</code> separately.'],
  ['w, h', '1920, 1080', `Pixels. Min ${LIMITS.minDim}, max ${LIMITS.maxDim}, at most ${(LIMITS.maxPixels / 1e6).toFixed(1)} megapixels in total.`],
  ['px', '4', 'Pixel size <code>1</code>–<code>16</code>. <code>1</code> = smooth, native resolution.'],
  ['blur', '0', 'Gaussian blur <code>0</code>–<code>30</code>. Grain and vignette are applied after, so they stay crisp.'],
  ['grain', '1', 'Film grain, <code>1</code> or <code>0</code>.'],
  ['vignette', '1', 'Edge darkening, <code>1</code> or <code>0</code>.'],
  ['invert', '0', 'Swap light and dark in the palette.'],
  ['format', 'png', '<code>png</code>, <code>jpeg</code> or <code>webp</code> (animated: <code>webp</code> or <code>gif</code>).'],
  ['quality', '90', '<code>1</code>–<code>100</code>, for <code>jpeg</code> and <code>webp</code>.'],
  ['download', '–', 'Add <code>download=1</code> to receive a <code>Content-Disposition: attachment</code> filename.'],
  ['animate', '–', 'Add <code>animate=1</code> for a seamless animated loop. See <a href="#animated">Animated images</a>.'],
];
const animParams = [
  ['animate', '–', '<code>1</code> to animate.'],
  ['frames', String(d.animation.frames.def), `Number of frames, ${d.animation.frames.min}–${d.animation.frames.max}.`],
  ['fps', String(d.animation.fps.def), `Playback speed, ${d.animation.fps.min}–${d.animation.fps.max}. The loop lasts <code>frames ÷ fps</code> seconds.`],
  ['format', 'webp', '<code>webp</code> (small, great quality) or <code>gif</code> (works everywhere).'],
  ['size', d.animation.defaultSize, `Max ${(d.animation.maxPixels / 1e6).toFixed(0)} megapixel per frame, and <code>frames × w × h</code> ≤ ${(d.animation.maxFramePixels / 1e6).toFixed(0)} megapixels.`],
  ['grain', '0', 'Off by default: fresh grain on every frame makes files much bigger.'],
];
const rows = (list) => list.map(([a, b, c]) => `<tr><td><code>${esc(a)}</code></td><td><code>${esc(b)}</code></td><td>${c}</td></tr>`).join('\n');
const table = (list) => `<div class="tablewrap"><table><thead><tr><th>Parameter</th><th>Default</th><th>Description</th></tr></thead><tbody>\n${rows(list)}\n</tbody></table></div>`;

const catName = Object.fromEntries(d.categories.map((c) => [c.id, c.name]));
const styleRows = d.styles.map((s) => `<tr><td><img loading="lazy" decoding="async" width="160" height="90" alt="${esc(s.name)} style example" src="api/wallpaper?seed=docs-${s.id}&amp;style=${s.id}&amp;palette=${s.id === 'ridgelines' ? 'mono' : 'neon'}&amp;size=320x180&amp;format=webp&amp;quality=70"></td><td><code>${s.id}</code></td><td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.description)}</span></td><td>${esc(catName[s.category] || '')}</td></tr>`).join('\n');
const palRows = d.palettes.map((p) => `<div class="pal"><div class="sw">${p.colors ? p.colors.map((c) => `<i style="background:${c}"></i>`).join('') : '<i class="auto">auto</i>'}</div><code>${p.id}</code></div>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seedscape API Docs: Generate Wallpapers with a Simple Image URL</title>
<meta name="description" content="Seedscape image API reference: wallpapers from a URL as PNG, JPEG, WebP or animated GIF. ${d.styles.length} styles, seeds, palettes, animation and limits. Free, no API key.">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#08090d">
<link rel="canonical" href="${SITE}/docs">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Seedscape">
<meta property="og:title" content="Seedscape API docs: wallpapers from a URL">
<meta property="og:description" content="Free image API: PNG, JPEG, WebP and animated GIF wallpapers from a URL. No API key.">
<meta property="og:url" content="${SITE}/docs">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preload" href="fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="site.css">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"TechArticle","headline":"Seedscape API documentation","description":"Reference for the Seedscape image API.","url":"${SITE}/docs","image":"${SITE}/og.png","author":{"@type":"Person","name":"Mario Skraban"},"about":{"@type":"SoftwareApplication","name":"Seedscape","url":"${SITE}/"}},
 {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Seedscape","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"API docs","item":"${SITE}/docs"}]}
]}
</script>
<style>
  .docs { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 56px; padding-top: 56px; padding-bottom: 96px; }
  .docs > * { min-width: 0; }
  .toc { position: sticky; top: 92px; align-self: start; font-size: 14.5px; }
  .toc h4 { font: 600 12.5px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--faint); margin: 0 0 12px; }
  .toc a { display: block; text-decoration: none; color: var(--muted); padding: 6px 12px; border-left: 2px solid var(--line); }
  .toc a:hover { color: var(--text); border-color: var(--accent2); }
  @media (max-width: 900px) { .docs { grid-template-columns: minmax(0, 1fr); gap: 24px; } .toc { position: static; display: flex; flex-wrap: wrap; gap: 6px; } .toc h4 { display: none; } .toc a { border: 1px solid var(--line); border-radius: 999px; } }
  .doc h1 { font-size: clamp(36px, 5vw, 56px); margin-bottom: 14px; }
  .doc h2 { font-size: 30px; margin: 64px 0 14px; padding-top: 8px; }
  .doc h3 { font-size: 20px; margin: 30px 0 10px; }
  .doc p { color: var(--muted); margin: 0 0 14px; max-width: 72ch; }
  .doc a { color: #ffb3d9; text-underline-offset: 3px; } .doc a:hover { color: #fff; }
  .doc ul { color: var(--muted); padding-left: 20px; max-width: 72ch; } .doc li { margin: 6px 0; }
  .muted { color: var(--faint); font-size: 14px; }
  .tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; margin: 18px 0 24px; }
  table { border-collapse: collapse; width: 100%; font-size: 14.5px; }
  th { text-align: left; font: 600 12px var(--font-mono); letter-spacing: .07em; text-transform: uppercase; color: var(--faint); padding: 13px 16px; background: var(--bg2); border-bottom: 1px solid var(--line); }
  td { padding: 13px 16px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--muted); }
  tr:last-child td { border-bottom: 0; } td code { white-space: nowrap; }
  td img { display: block; width: 160px; height: 90px; border-radius: 8px; background: #0d0f16; object-fit: cover; }
  .pals { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin: 18px 0; }
  .pal { display: grid; gap: 8px; } .pal .sw { display: flex; height: 30px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); } .pal .sw i { flex: 1; font: 600 12px/30px var(--font-mono); text-align: center; color: #fff; font-style: normal; } .pal .sw i.auto { background: var(--grad); color: #12101c; }
  .ep { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin: 10px 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  .ep b { font: 700 12px var(--font-mono); background: rgba(92, 230, 196, .14); color: var(--mint); padding: 3px 8px; border-radius: 6px; } .ep code { background: none; border: 0; font-size: 14.5px; color: var(--text); } .ep span { color: var(--muted); font-size: 14.5px; }
  .demo { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 18px 0; } @media (max-width: 700px) { .demo { grid-template-columns: 1fr; } }
  .demo figure { margin: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--panel); } .demo img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; } .demo figcaption { padding: 10px 14px; font: 500 12px var(--font-mono); color: var(--muted); word-break: break-all; }
  .note { border-left: 3px solid var(--accent3); background: rgba(255, 193, 92, .07); padding: 14px 18px; border-radius: 0 12px 12px 0; color: var(--muted); margin: 18px 0; max-width: 72ch; }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav"><div class="container">
  <a class="brand" href="/" aria-label="Seedscape home"><svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset=".55" stop-color="#ff5ca8"/><stop offset="1" stop-color="#ffc15c"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#0b0c11" stroke="rgba(255,255,255,.12)"/><rect x="11" y="33" width="12" height="20" rx="3" fill="url(#lg)"/><rect x="26" y="17" width="12" height="36" rx="3" fill="url(#lg)"/><rect x="41" y="25" width="12" height="28" rx="3" fill="url(#lg)"/></svg>Seedscape</a>
  <nav class="nav-links" aria-label="Main"><a href="/#styles">Styles</a><a href="/docs" aria-current="page">API</a><a href="/live">Live</a><a href="https://github.com/mskraban/seedscape" rel="noopener">GitHub</a><a class="btn primary sm keep" href="/app">Open the app</a></nav>
</div></header>

<main id="main" class="container docs">
  <nav class="toc" aria-label="On this page"><h4>On this page</h4>
    <a href="#quickstart">Quick start</a><a href="#endpoints">Endpoints</a><a href="#parameters">Parameters</a><a href="#styles">Styles</a><a href="#palettes">Palettes</a><a href="#animated">Animated images</a><a href="#live">Live wallpaper</a><a href="#responses">Responses &amp; caching</a><a href="#limits">Errors &amp; limits</a><a href="#examples">Examples</a>
  </nav>
  <article class="doc">
    <div class="eyebrow">API reference</div>
    <h1>Wallpapers from <span class="grad-text">a URL</span>.</h1>
    <p>The Seedscape API renders a wallpaper from query parameters and returns an image. There are no keys, accounts or rate-limit tiers. The same URL always returns the same image, so it is safe to cache and to use in production pages.</p>
    <p class="muted">Base URL: <code>${SITE}</code> · Engine version <code>${d.engineVersion}</code> · ${d.styles.length} styles · CORS open (<code>*</code>)</p>

    <h2 id="quickstart">Quick start</h2>
    <div class="codewrap"><pre class="code" id="q1"><span class="k">&lt;img</span> src=<span class="s">"${SITE}/api/wallpaper?seed=hello&amp;style=aurora&amp;palette=neon&amp;size=1200x400"</span> alt=<span class="s">"Header"</span> <span class="k">/&gt;</span></pre><button class="copy" data-copy="q1">Copy</button></div>
    <div class="demo">
      <figure><img loading="lazy" width="640" height="360" alt="Example wallpaper from the API" src="api/wallpaper?seed=hello&amp;style=aurora&amp;palette=neon&amp;size=640x360&amp;format=webp"><figcaption>?seed=hello&amp;style=aurora&amp;palette=neon</figcaption></figure>
      <figure><img loading="lazy" width="640" height="360" alt="Example animated wallpaper from the API" src="api/wallpaper?seed=hello&amp;style=planet&amp;palette=ocean&amp;animate=1&amp;size=640x360&amp;frames=18"><figcaption>?seed=hello&amp;style=planet&amp;animate=1</figcaption></figure>
    </div>

    <h2 id="endpoints">Endpoints</h2>
    <div class="ep"><b>GET</b><code>/api/wallpaper</code><span>Render a wallpaper (PNG, JPEG, WebP, or animated WebP/GIF).</span></div>
    <div class="ep"><b>GET</b><code>/w/:seed</code><span>Short form: <code>/w/hello?style=waves</code>.</span></div>
    <div class="ep"><b>GET</b><code>/random</code><span>A fresh random wallpaper on every request.</span></div>
    <div class="ep"><b>GET</b><code>/api/random</code><span>A random seed, style and palette as JSON, with ready-to-use URLs. Add <code>?redirect=1</code> to be redirected to the image.</span></div>
    <div class="ep"><b>GET</b><code>/api/styles</code><span>Machine-readable catalogue of styles, palettes, sizes, defaults and limits.</span></div>

    <h2 id="parameters">Parameters</h2>
    <p>All parameters are optional. Everything goes in the query string of <code>/api/wallpaper</code>.</p>
    ${table(params)}

    <h2 id="styles">Styles</h2>
    <p>Pass the <code>id</code> as <code>style=</code>. The previews below are rendered live by the API (neon palette, still frame).</p>
    <div class="tablewrap"><table><thead><tr><th>Preview</th><th>id</th><th>Look</th><th>Category</th></tr></thead><tbody>
${styleRows}
    </tbody></table></div>

    <h2 id="palettes">Palettes</h2>
    <p>Pass the <code>id</code> as <code>palette=</code>. <code>auto</code> generates a harmonious palette (analogous, complementary, triad, split or monochrome) from the seed itself. Add <code>invert=1</code> to swap light and dark.</p>
    <div class="pals">${palRows}</div>

    <h2 id="animated">Animated images</h2>
    <p>Add <code>animate=1</code> to get a seamlessly looping animation. Frame <i>i</i> of <i>N</i> is drawn at loop time <i>i ⁄ N</i>, so the last frame flows straight back into the first. All ${d.styles.length} styles support it.</p>
    <div class="codewrap"><pre class="code" id="a1">${SITE}/api/wallpaper?seed=hello&amp;style=planet&amp;animate=1&amp;frames=36&amp;fps=18&amp;format=gif&amp;size=640x360</pre><button class="copy" data-copy="a1">Copy</button></div>
    ${table(animParams)}
    <p>Responses include <code>X-Seedscape-Frames</code> and <code>X-Seedscape-Fps</code>. Each frame is a full render on a serverless function, which is why the limits are small. For longer or bigger animation use the <a href="#live">live page</a> or record a loop in the <a href="/app">app</a>; both run on your own device.</p>

    <h2 id="live">Live wallpaper page</h2>
    <p><a href="/live">/live</a> is a fullscreen page that animates one wallpaper forever. Put options in the URL hash, e.g. <code>/live#seed=hello&amp;s=synthwave&amp;p=Neon&amp;d=12</code>.</p>
    ${table([['seed, s, p', '–', 'Seed, style id and palette name (as in the app, e.g. <code>Neon</code>).'], ['px, b', '4, 0', 'Pixel size 1–16 and blur 0–30.'], ['d', '12', 'Loop length in seconds, 2–60.'], ['c', '0', 'Pick a fresh seed every <i>c</i> seconds.'], ['shuffle', '–', '<code>1</code> with <code>c</code> also picks a random style each time.'], ['ui', '1', '<code>0</code> hides the on-screen hint.']])}
    <p>Keys: <kbd>R</kbd>/<kbd>Space</kbd> new wallpaper · <kbd>[</kbd> <kbd>]</kbd> style · <kbd>P</kbd> pause · <kbd>F</kbd> fullscreen. It honours the system <i>reduce motion</i> setting. It also works as a URL in live-wallpaper tools such as <a href="https://github.com/rocksdanister/lively" rel="noopener">Lively</a>.</p>

    <h2 id="responses">Responses &amp; caching</h2>
    <ul>
      <li><b>Deterministic.</b> The same query returns the same bytes. Responses with a <code>seed</code> are sent with <code>Cache-Control: public, max-age=31536000, immutable</code>.</li>
      <li><b>Random images</b> (no <code>seed</code>) are sent with <code>no-store</code>. The seed used is in the <code>X-Seedscape-Seed</code> header.</li>
      <li><code>X-Seedscape-Engine</code> is the engine version. It only changes if a change would alter what an existing seed produces.</li>
      <li><code>HEAD</code> and <code>OPTIONS</code> are supported. Errors are JSON.</li>
    </ul>

    <h2 id="limits">Errors &amp; limits</h2>
    <div class="tablewrap"><table><thead><tr><th>Status</th><th>When</th></tr></thead><tbody>
      <tr><td><code>400</code></td><td>Invalid or out-of-range parameter. The JSON <code>error</code> says which one and what is allowed.</td></tr>
      <tr><td><code>405</code></td><td>Method other than <code>GET</code>, <code>HEAD</code> or <code>OPTIONS</code>.</td></tr>
      <tr><td><code>413</code></td><td>The encoded image would exceed the 4.5 MB response limit (rare; use <code>format=webp</code>).</td></tr>
    </tbody></table></div>
    <div class="note">Still images: up to ${LIMITS.maxDim} px per side and ${(LIMITS.maxPixels / 1e6).toFixed(1)} megapixels. Animations: up to ${d.animation.frames.max} frames, ${(d.animation.maxPixels / 1e6).toFixed(0)} megapixel per frame, and ${(d.animation.maxFramePixels / 1e6).toFixed(0)} megapixels in total.</div>
    <pre class="code">{ "error": "\\"style\\" must be one of: horizon, aurora, mosaic, …", "hint": "GET /api/styles lists every valid option." }</pre>

    <h2 id="examples">Examples</h2>
    <h3>CSS background</h3>
    <div class="codewrap"><pre class="code" id="e1">body { background: url("${SITE}/api/wallpaper?seed=my-site&amp;style=mesh&amp;blur=6&amp;format=webp") center / cover fixed; }</pre><button class="copy" data-copy="e1">Copy</button></div>
    <h3>A different wallpaper every day</h3>
    <div class="codewrap"><pre class="code" id="e2">const today = new Date().toISOString().slice(0, 10);  // "2026-10-31"
img.src = \`${SITE}/api/wallpaper?seed=\${today}&amp;style=horizon\`;</pre><button class="copy" data-copy="e2">Copy</button></div>
    <h3>Python</h3>
    <div class="codewrap"><pre class="code" id="e3">import requests
r = requests.get("${SITE}/api/wallpaper",
                 params={"seed": "hello", "style": "mosaic", "palette": "game-boy", "size": "800x600"})
open("hello.png", "wb").write(r.content)</pre><button class="copy" data-copy="e3">Copy</button></div>
    <h3>Phone wallpapers</h3>
    <p>iPhone: <code>size=1170x2532</code> · Android: <code>size=1080x2400</code> · Desktop 4K: <code>size=3840x2160&amp;format=webp</code> · Square avatar: <code>size=1024x1024</code>.</p>
  </article>
</main>

<footer class="footer"><div class="container">
  <div><a class="brand" href="/" style="margin-bottom:14px"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0b0c11" stroke="rgba(255,255,255,.12)"/><rect x="11" y="33" width="12" height="20" rx="3" fill="url(#lg)"/><rect x="26" y="17" width="12" height="36" rx="3" fill="url(#lg)"/><rect x="41" y="25" width="12" height="28" rx="3" fill="url(#lg)"/></svg>Seedscape</a><p style="max-width:34ch">Deterministic generative wallpapers: same seed, same art. Free and open source.</p></div>
  <div><h4>Product</h4><a href="/app">Generator</a><a href="/live">Live wallpaper</a><a href="/#styles">Style gallery</a></div>
  <div><h4>Developers</h4><a href="/docs">API docs</a><a href="https://github.com/mskraban/seedscape" rel="noopener">GitHub</a><a href="https://github.com/mskraban/seedscape/issues" rel="noopener">Report an issue</a></div>
  <div><h4>Project</h4><a href="https://github.com/mskraban/seedscape/blob/main/README.md" rel="noopener">README</a><a href="https://github.com/mskraban/seedscape/blob/main/LICENSE" rel="noopener">MIT license</a><a href="/sitemap.xml">Sitemap</a></div>
  <div class="fine"><span>© 2026 Mario Skraban · MIT licensed</span><span>Fonts: Inter, Bricolage Grotesque, JetBrains Mono (SIL OFL)</span></div>
</div></footer>
<script>
document.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', async () => {
  const txt = document.getElementById(b.dataset.copy).innerText;
  try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Press Ctrl+C'; }
  setTimeout(() => { b.textContent = 'Copy'; }, 1500);
}));
</script>
</body>
</html>
`;
fs.writeFileSync(process.env.DOCS_OUT || path.join(__dirname, '..', 'public', 'docs.html'), html);
console.log('docs.html written:', (html.length / 1024).toFixed(0) + ' KB,', d.styles.length, 'styles,', d.palettes.length, 'palettes');
