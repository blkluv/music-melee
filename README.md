# Music Melee

The game is called Music Melee (a working title) and involves fast and responsive parkour-like gameplay as players bounce around the environment and melee blocks. As the name suggests, the twist is that everything in the game creates dynamic sounds (mapped out in stereo 3D) and the more chaotic the battles get, the more sonically interesting it becomes. Players can get powerups for musically-interesting behaviour like achieving certain harmonies or matching the rhythm of the arena (which is procedurally generated at the start of the match). Matches are 2 minutes long and then the arena resets.

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

**Upcoming:**

- [ ] Vibey background music (in C Lydian) that adapts to increasing tempo and helps the players hear which blocks are in key
- [ ] More visual and auditory feedback: tempo flash, sounds / colours / confetti for perfect on-tempo in-key hits, etc.
- [ ] Mobile support and tap controls
- [ ] Leaderboard / score sharing option
- [ ] levels portal: https://gist.github.com/levelsio/ffdbfe356b421b97a31664ded4bc961d

## Progress

- **3D Sound & Audio Chain:**

  - Implemented dynamic 3D spatial sound using Tone.js, including synthesizers routed through filters, spatial volume nodes, and Panner3D.
  - Improved listener processing by updating both position and orientation every frame.
  - Reduced distance falloff intensity for more consistent volume with distance.

- **Block Handling & Feedback:**

  - Each falling block now creates its own audio chain and flashes on collision.
  - Fixed issues with green blocks by switching from a MetalSynth to a percussive MembraneSynth.
  - Added a ticker block at the center of the arena that flashes and plays a click sound every 2 seconds for debugging spatial audio.

- **Player Movement:**

  - Adjusted player movement to be more responsive with increased horizontal speed.
  - Reduced jump power substantially (now 50% weaker) while keeping overall movement fast.

- **General Improvements:**
  - Enhanced collision handling to trigger sounds based on impact velocity.
  - Integrated debugging elements (block counter and Stats.js) for performance and collision feedback.

## Tech Stack

- **TypeScript**: Provides static type-checking, enhanced code quality, and developer productivity.
- **Three.js**: Renders advanced 3D graphics using WebGL.
- **Tone.js**: Powers dynamic, spatial audio synthesis and musical interactions.
- **cannon-es**: Simulates the physics (collisions, forces, etc.) in a realistic manner.
- **Vite**: Bundles and serves the client-side code with fast live-reload during development.
- **Node.js**: Hosts the backend server for real-time multiplayer interactions via websockets.

## Workflow & Commands

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
