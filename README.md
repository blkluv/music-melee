# Music Melee

A multiplayer 3D game that will run efficiently off a Node server using websockets.

The game is called Music Melee (a working title) and involves fast and responsive parkour-like gameplay as players bounce around the environment and melee each other. As the name suggests, the twist is that everything in the game creates dynamic sounds (mapped out in stereo 3D) and the more chaotic the battles get, the more sonically interesting it becomes. Players can get powerups for musically-interesting behaviour like achieving certain harmonies or matching the rhythm of the arena (which is procedurally generated at the start of the match). Matches are 2 minutes long and then the arena resets.

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
