# Personal Portfolio - League of Legends Theme

A 3D interactive portfolio website featuring Summoner's Rift from League of Legends, with real-time match data integration.

## Features

- 🎮 3D Summoner's Rift map visualization
- 🎵 Background music player with League of Legends soundtrack
- 📊 Real-time League of Legends match data (via Riot API)
- 🎨 League of Legends themed UI with Hextech styling
- 🎬 Cinematic camera controls and auto-exploration mode
- 🖱️ Custom cursor and interactive controls

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Riot API (For Match Data)

To display your latest League of Legends match:

1. Get a Riot API key from [Riot Developer Portal](https://developer.riotgames.com/)
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Add your API key to `.env`:
   ```
   VITE_RIOT_API_KEY=your_riot_api_key_here
   ```
4. Install proxy server dependencies:
   ```bash
   cd proxy-server
   npm install
   ```
5. Start the proxy server:
   ```bash
   npm start
   ```
   (Keep this running in a separate terminal)

6. Update your Riot ID in `src/SummonersRift/SummonersRift.tsx`:
   ```typescript
   // In GameCard component, line ~20
   const data = await getLatestGame('YourGameName', 'NA1')
   ```

### 3. Run the Development Server

```bash
npm run dev
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

## Project Structure

```
src/
├── SummonersRift/
│   ├── SummonersRift.tsx    # Main 3D scene and UI
│   ├── SummonersRift.css    # Styles
│   ├── riotApi.ts           # Riot API integration
│   └── Textures/            # 3D model textures
├── music/                    # Background music files
└── profile/                  # Profile icons and assets

proxy-server/
├── server.js                 # Proxy server for Riot API
└── README.md                 # Proxy setup instructions
```

## Technologies

- **React** + **TypeScript**
- **Three.js** + **React Three Fiber** - 3D rendering
- **Vite** - Build tool
- **Riot Games API** - Match data
- **Express** - Proxy server

## Customization

### Update Profile Information

Edit `src/SummonersRift/SummonersRift.tsx`:

```typescript
// Around line 1100, in the center panel
<h2>Your Name</h2>
<p>"Your quote here"</p>
```

### Update Social Links

Replace the URLs in the social links section:
- Email: `mailto:your-email@example.com`
- GitHub: `https://github.com/your-username`
- LinkedIn: `https://linkedin.com/in/your-profile`
- LeetCode: `https://leetcode.com/your-username`

### Add Music

Place your `.mp3` files in `src/music/` and update the playlist in `MusicPlayer` component.

## URL Parameters

- `?secret=true` - Shows full profile panel with match data and music player
- Default (no parameter) - Shows minimal "Start Exploring" button

## Deployment

Build for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deploy to GitHub Pages

```bash
npm run deploy
```

**Note**: For production, you'll need to deploy the proxy server separately (e.g., on Heroku, Vercel, or Railway) and update the `PROXY_URL` in `riotApi.ts`.

## Troubleshooting

### Riot API not working
1. Check if proxy server is running: `curl http://localhost:3001/health`
2. Verify API key in `.env` file
3. Development keys expire after 24 hours - generate a new one
4. Check browser console for detailed error messages

### 3D Model not loading
- Ensure `rift-opt.glb` exists in `src/` directory
- Check browser console for loading errors

### Music not playing
- Click anywhere on the page to start audio (browser autoplay policy)
- Check music files exist in `src/music/` directory
- Verify file paths in `MusicPlayer` component

## License

MIT License - feel free to use this for your own portfolio!

## Credits

- Summoner's Rift 3D model and textures © Riot Games
- Music tracks © respective artists
- Icons from [SVG Repo](https://www.svgrepo.com/)
