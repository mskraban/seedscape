# Contributing to Seedscape

Thanks for helping! Seedscape is small on purpose: one drawing engine (`public/engine.js`) shared by the browser and the server.

## Setup

```bash
git clone https://github.com/mskraban/seedscape.git
cd seedscape
npm install
npm test        # should be all green
npm run dev     # http://localhost:3000
```

Node 20 or newer. There is no build step for the site.

## Adding a style

1. Write a function `myStyle(ctx, w, h, rng, pal, time)` in `public/engine.js` and register it in `STYLES` with a `name` and `sub` (short description). Add it to a category in `CATEGORIES`.
   - Use only `rng` for randomness (never `Math.random()` while drawing), so a seed always gives the same image.
   - `pal` is sorted dark → light; `colorAt(pal, 0..1)` samples it.
   - `time` is `undefined` for stills and a number in `[0, 1)` for animation frames. Make motion loop seamlessly: use whole cycles (`Math.sin(ap + …)` with `ap = time * 2π`), drift on circles, or scroll by exactly one pattern period.
   - Keep a 1080p frame under ~100 ms and 4K `px=1` under ~6 s.
2. Add a `PICKS` entry in `public/index.html` (seed + palette for the homepage tile).
3. Run `npm run docs` to refresh `public/docs.html`.
4. Run `npm test`. It checks determinism, seamless loops, categories, docs freshness and more.

**Never change what an existing seed produces.** A test pins the output of every existing style. If you really must change one, bump `VERSION` in the engine and say so in the pull request.

## Pull requests

- Keep them focused, and include a screenshot or short clip of what changed.
- `npm test` must pass (CI runs it).
- New user-facing text: plain, friendly, no jargon.

## Reporting bugs

Open an issue with the full URL that shows the problem. It contains everything needed to reproduce it (seed, style, palette, size). Browser and OS help too.

## Code of conduct

Be kind and assume good intent. Harassment and personal attacks are not tolerated.
