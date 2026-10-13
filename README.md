# Personal Portfolio - League of Legends Theme

A 3D interactive portfolio website featuring Summoner's Rift from League of Legends.

## Features

- 🎮 3D Summoner's Rift map visualization
- 🎵 Background music player with League of Legends soundtrack
- 🎨 League of Legends themed UI with Hextech styling
- 🎬 Cinematic camera controls and auto-exploration mode
- 🖱️ Custom cursor and interactive controls
- 📄 In-browser PDF viewer with one-click translation — append any PDF URL to
  the site (e.g. `longpanzhou.github.io/arxiv.org/pdf/1706.03762`) to render it
  and translate it to any language

## PDF viewer & translator

Any unrecognized path is treated as a PDF URL:

```
https://longpanzhou.github.io/arxiv.org/pdf/1706.03762
https://longpanzhou.github.io/https://example.com/paper.pdf
```

GitHub Pages' `404.html` SPA redirect hands the path to the React app, which
loads the file with [`pdfjs-dist`](https://github.com/mozilla/pdf.js) and
renders every page to a canvas. The toolbar's **Translate** button extracts the
text layer per page and translates it with GLM (Z.ai). Browsers can't call GLM
directly, so the viewer calls a same-origin `/glm-api` path. In local dev, Vite
forwards that path with `GLM_API_KEY` from `.env.local`. The deployed site needs
a server-side proxy at the same path before translation works there. Pick a
language from the list or type any language name or code.

For local testing, put `GLM_API_KEY=...` in `.env.local` (git-ignored). It isn't
`VITE_`-prefixed, so Vite never inlines it into the public JavaScript. Keep it
that way: a key in any `VITE_` variable ends up in the published site.

Requirements: the PDF host must send permissive CORS headers
(`Access-Control-Allow-Origin`). arXiv does.

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Run the Development Server

```bash
bun run dev
```

Visit `http://localhost:5173` (or the URL shown in terminal)

## Controls

- **C**: Toggle cinematic camera mode (auto-exploration)
- **W/A/S/D**: Move camera (forward/left/back/right)
- **Q/E**: Move camera down/up
- **Left Click + Drag**: Rotate view
- **Right Click + Drag**: Pan camera
- **Scroll**: Zoom in/out
- **Back to Home**: Return to profile panel

## Technologies

- **React** + **TypeScript**
- **Three.js** + **React Three Fiber** - 3D rendering
- **Vite** - Build tool

## Customization

### Add Music

Place your `.mp3` files in `src/music/` and update the playlist in `MusicPlayer` component.

## Deployment

Build for production:

```bash
bun run build
```

The built files will be in the `dist/` directory.

### Deploy to GitHub Pages

```bash
bun run deploy
```

## License

MIT License - feel free to use this for your own portfolio!

## Credits
- Music tracks © respective artists