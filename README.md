# Rahul Visualzz — Portfolio

Portfolio site for Rahul Mehra, freelance video editor and motion designer.

**Live:** https://rahulvisualzz.netlify.app

## What's here

```
index.html      the entire site — markup, styles and scripts in one file
Assets/         profile photo and video thumbnails (WebP)
```

There is no build step and no dependencies. `index.html` is self-contained.

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

- **Hero background** — a WebGL fragment shader (`initBgfx`) running a
  domain-warped simplex-noise field. Written against raw WebGL rather than a
  library, so it costs nothing beyond the page itself.
- **Smooth scrolling** — a transform-based momentum scroller. Because the
  wrapper is `position: fixed` and transformed, `position: sticky` does not work
  anywhere inside it, and `position: fixed` children are contained by it. The
  video viewer sits outside the wrapper for this reason.
- **Video viewer** — clicking a project builds a YouTube iframe on demand and
  destroys it on close. Embeds are never present at page load, so nothing is
  requested from Google until someone chooses to watch something.
- **Theme** — dark/light toggle, persisted in `localStorage`.

## Deploying

The site is hosted on Netlify. Only the files the page actually references need
uploading — `index.html` and the WebP assets. `Assets/Profile Photo.png` is the
untouched master for `profile.webp` and is not used by the page.
