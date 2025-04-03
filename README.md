# Music Melee

For the [Vibe Jam 2025](https://jam.pieter.com/). 

Vibecoded with love by [Gianluca](https://gianluca.ai) using Aider, OpenAI o3-mini, and Claude 3.7 Sonnet

- Play now: [Music Melee](https://music-melee.vercel.app/) (best on desktop)
- Blog post: [Music Melee: a high-speed parkour FPS for making beautiful sounds | Gianluca.ai](https://gianluca.ai/music-melee/)
- [Thread on X](https://x.com/gianluca_truda/status/1907827373279498677
) with gameplay video
- [Thread on Bluesky](https://bsky.app/profile/gianlucatruda.bsky.social/post/3llwby6l6lc2m
) with gameplay video
- [Show HN: Music Melee – High-speed parkour FPS for making beautiful music | Hacker News](https://news.ycombinator.com/item?id=43571169)

---

![SCR-20250401-ejex](https://github.com/user-attachments/assets/feecf200-64dd-4f40-bb8a-413ab4f9eeb1)

![SCR-20250401-ejqh](https://github.com/user-attachments/assets/b9e582ed-56a4-40fd-8150-1b576913e3d1)


---

I vibecoded the entire thing for [Vibe Jam 2025](https://jam.pieter.com/). I used [Aider](https://aider.chat/) in "architect" mode from my command line -- OpenAI's o3-mini analysed the code and planned how to apply my prompt, then handed the plan to Anthropic's Claude 3.7 sonnet to execute the changes. 

## Tech Stack

- **TypeScript**: Provides static type-checking, enhanced code quality, and developer productivity.
- **Three.js**: Renders advanced 3D graphics using WebGL.
- **Tone.js**: Powers dynamic, spatial audio synthesis and musical interactions.
- **cannon-es**: Simulates the physics (collisions, forces, etc.) in a realistic manner.
- **Vite**: Bundles and serves the client-side code with fast live-reload during development.
- **Node.js**: Hosts the backend server for real-time multiplayer interactions via websockets.

## Roadmap

**Completed:**

- [x] Initial 3D spatial sound implementation with dynamic audio chains per block.
- [x] Improved listener orientation and reduced sound distance falloff.
- [x] Fine-tuned player movement (faster horizontal movement and reduced jump power).
- [x] Debugging tools: ticker block with periodic flashing and click sound, block counter, and performance stats.
- [x] Plug to personal site: "Vibecoded with love by [Gianluca](https://gianluca.ai) using Aider, OpenAI o3-mini, and Claude 3.7 Sonnet"
- [x] Updated scoring based on rhythm and notes in key
- [x] Instructions on how to play / objectives on loading screen, then "press and key / tap to begin"
- [x] Vibe Jam 2025 snippet [^0]
- [x] Play again / new round
- [x] More visual and auditory feedback: tempo flash, sounds / colours / confetti for perfect on-tempo in-key hits, etc.
- [x] Vibey background music (in C Lydian) that adapts to increasing tempo and helps the players hear which blocks are in key
- [x] UI fixes and cleanup
- [x] Lighting, ambient illumination, and sky colour changes should be more gradual and elegant.
- [x] Block colours should be more easily distinguished. Dissonant blocks on opposite ends of colour spectrum.
- [x] Mobile support and tap controls

**Upcoming:**

- [ ] Leaderboard / score sharing option
- [ ] BONUS: levels' player portal: https://gist.github.com/levelsio/ffdbfe356b421b97a31664ded4bc961d

## Usage

### Installation

To install all the dependencies, run:

```bash
npm install
```

### Development

Start a live-reload development server with:

```bash
npm run dev
```

This command uses Vite to serve your client from the `src` folder and will automatically open your browser.

### Production Build

To build the production-ready files, run:

```bash
npm run build
```

### Preview Production Build

To preview the production build locally, run:

```bash
npm run preview
```

### Deployment

Deploy the contents of the `dist` directory to your preferred hosting provider or server setup.
