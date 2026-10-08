# Rahul Visualzz — Portfolio

Portfolio site for Rahul Mehra, freelance video editor and motion designer.

**Live:** https://rahulvisualzz.netlify.app

## What's here

```
index.html          markup only
css/styles.css      all styles
js/hero-shader.js   the WebGL hero background
js/main.js          scrolling, reveals, video viewer, theme toggle
Assets/             profile photo and video thumbnails (WebP)
```

There is no build step, no bundler and no dependencies — these files are served
exactly as written.

One script stays inline, in `index.html`'s `<head>`: the theme guard. It reads
the saved theme and sets a class on `<html>` before the first paint. Moved to an
external file it would be fetched *after* that paint, and the page would flash
the wrong theme on every load. Everything else is `defer`red.

## Running it locally

Open it through a local server, **not** by double-clicking the file:

```bash
npx -y serve . -l 4321
```

then visit <http://localhost:4321>.

This matters: a page opened as `file://` has no origin, and YouTube refuses to
configure a player without one — the embedded videos fail with *Error 153*. The
page detects this and says so rather than showing YouTube's error.

## Notable pieces

- **Hero background** (`js/hero-shader.js`) — a WebGL fragment shader running a
  domain-warped simplex-noise field. Written against raw WebGL rather than a
  library, so it costs nothing beyond the page itself.
- **Smooth scrolling** (`js/main.js`) — a transform-based momentum scroller.
  Because the wrapper is `position: fixed` and transformed, `position: sticky`
  does not work anywhere inside it, and `position: fixed` children are contained
  by it. The video viewer sits outside the wrapper for this reason.
- **Video viewer** — clicking a project builds a YouTube iframe on demand and
  destroys it on close. Embeds are never present at page load, so nothing is
  requested from Google until someone chooses to watch something.
- **Background orbs** (`css/styles.css`) — three large drifting radial
  gradients. Their falloff is `(1-x)²` deliberately: it tapers from the centre
  so there is no flat top to read as a disc, and its slope reaches zero at the
  rim so there is no ring edge either. A plain two-stop gradient leaves a
  visible oval.
- **Theme** — dark/light toggle, persisted in `localStorage`.

## Deploying

The site is hosted on Netlify. Only the files the page actually references need
uploading — `index.html`, `css/`, `js/` and the WebP assets.
`Assets/Profile Photo.png` is the untouched master for `profile.webp`, is not
used by the page, and is excluded from the repo by `.gitignore`.
