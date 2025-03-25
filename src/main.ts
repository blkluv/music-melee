// Music Melee - Main Entry Point
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TONE from "tone";
import * as CANNON from "cannon-es";

// Initialize the game
async function init() {
  console.log("Music Melee initializing...");

  // Set up low-latency audio context configuration
  const audioContext = new AudioContext({ latencyHint: "interactive" });
  TONE.setContext(audioContext);

  // Setup Three.js scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#87CEEB");
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  // Add an AudioListener to the camera for 3D audio
  const audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  // Cache Tone.js transport for scheduling events
  const transport = TONE.getTransport();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: for a softer shadow look
  document.body.appendChild(renderer.domElement);

  // Setup Tone.js – resume audio context on first user interaction
  document.body.addEventListener(
    "click",
    async () => {
      if (TONE.getContext().state !== "running") {
        await TONE.start();
        // Reduce the lookAhead window for lower latency
        TONE.getContext().lookAhead = 0.01; // 10ms lookahead
        console.log("Tone.js audio context resumed with low latency settings");
      }
    },
    { once: true },
  );

  // Setup physics
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -20, 0),
  });

  // Initialize PointerLockControls for first-person navigation
  const controls = new PointerLockControls(camera, renderer.domElement);
  // Optionally, trigger pointer lock on a user gesture (e.g., a click)
  renderer.domElement.addEventListener("click", () => {
    controls.lock();
  });

  camera.position.z = 5;

  // Create a visual ground plane
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Remove ambient hemisphere light (we want the sun and block glow to be primary)
  // const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.2);
  // hemiLight.position.set(0, 200, 0);
  // scene.add(hemiLight);

  // Arena dimensions
  const arenaSize = 100; // width and depth

  // Wall parameters
  const wallThickness = 1;
  const wallHeight = 20;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
  const halfArena = arenaSize / 2;

  // Create a helper function to make a wall with matching physics body:
  function createWall(
    width: number,
    height: number,
    depth: number,
    pos: THREE.Vector3,
  ) {
    // Visual wall
    const wallGeo = new THREE.BoxGeometry(width, height, depth);
    const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
    wallMesh.position.copy(pos);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    // Create corresponding physics body (mass 0 for static)
    const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2);
    const wallShape = new CANNON.Box(halfExtents);
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.addShape(wallShape);
    wallBody.position.set(pos.x, pos.y, pos.z);
    world.addBody(wallBody);
  }

  // Floor-level walls: center walls are raised so that their base sits on ground. Assume ground at y=0, so center wall at y = wallHeight/2

  // North wall (z = -halfArena)
  createWall(
    arenaSize,
    wallHeight,
    wallThickness,
    new THREE.Vector3(0, wallHeight / 2, -halfArena),
  );
  // South wall (z = halfArena)
  createWall(
    arenaSize,
    wallHeight,
    wallThickness,
    new THREE.Vector3(0, wallHeight / 2, halfArena),
  );
  // East wall (x = halfArena)
  createWall(
    wallThickness,
    wallHeight,
    arenaSize,
    new THREE.Vector3(halfArena, wallHeight / 2, 0),
  );
  // West wall (x = -halfArena)
  createWall(
    wallThickness,
    wallHeight,
    arenaSize,
    new THREE.Vector3(-halfArena, wallHeight / 2, 0),
  );

  // Define the sun's positions so that at the start and end it sits at the horizon.
  const horizonY = 5; // Adjust this value if needed so it appears "at the horizon"
  const startPos = new THREE.Vector3(
    -halfArena * 1.5,
    horizonY,
    -halfArena * 1.5,
  );
  const midPos = new THREE.Vector3(0, 120, 0); // Noon: sun is high overhead
  const endPos = new THREE.Vector3(halfArena * 1.5, horizonY, halfArena * 1.5);

  // Define sun colors: warm reddish at start, white at noon, sunset red at end.
  const startColor = new THREE.Color(0xff4500); // warm reddish
  const midColor = new THREE.Color(0xffffff); // white
  const endColor = new THREE.Color(0xff0000); // sunset red

  // Define sky colors: start (dawn/dusk redish) and noon (blue)
  const dawnSkyColor = new THREE.Color(0xff4500); // redish
  const noonSkyColor = new THREE.Color(0x87ceeb); // blue

  // Create the sun with its initial parameters
  const sun = new THREE.DirectionalLight(startColor, 2.5);
  sun.position.copy(startPos);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  scene.add(sun);

  // Create a visible sun sphere to simulate the sun
  const sunSphereGeometry = new THREE.SphereGeometry(6, 32, 32); // larger sphere (radius 6)
  const sunSphereMaterial = new THREE.MeshBasicMaterial({ color: startColor });
  const sunSphere = new THREE.Mesh(sunSphereGeometry, sunSphereMaterial);
  sunSphere.position.copy(startPos);
  scene.add(sunSphere);

  // Create a simple player physics body (using a sphere shape)
  const playerShape = new CANNON.Sphere(1);
  const playerBody = new CANNON.Body({ mass: 10 });
  playerBody.addShape(playerShape);
  playerBody.position.set(0, 2, 0); // start a bit above ground
  world.addBody(playerBody);

  // Create a static ground plane for the player to stand on
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  playerBody.addEventListener("collide", (e: any) => {
    const otherBody = e.body;
    // Check if the collided body is a block (it has an assigned synth)
    if (otherBody && otherBody.assignedSynth) {
      // Get its associated mesh
      const mesh = (otherBody as any).mesh;
      if (!mesh) return;
      // Flash the block white
      const originalColor = mesh.userData.originalColor;
      // Store the original emissive intensity.
      const originalEmissiveIntensity = mesh.material.emissiveIntensity;
      // Flash: Override color and emissive properties to white and boost flash intensity.
      mesh.material.color.set(0xffffff);
      mesh.material.emissive.set(0xffffff);
      mesh.material.emissiveIntensity = 2;
      setTimeout(() => {
        // Restore original color and a subtler emissive glow.
        mesh.material.color.setHex(originalColor);
        mesh.material.emissive.setHex(originalColor);
        mesh.material.emissiveIntensity = 0.4;
      }, 150);

      // Compute impact velocity (if available) and ignore very soft collisions
      const impactVelocity =
        e.contact && e.contact.getImpactVelocityAlongNormal
          ? e.contact.getImpactVelocityAlongNormal()
          : 0;
      if (impactVelocity < 2) return;

      // Use our helper function to compute volume based on distance and impact
      otherBody.assignedVolume.volume.value = computeCollisionVolume(
        mesh,
        camera,
        impactVelocity,
      );

      // Use a simple cooldown check:
      const now = performance.now();
      if (!otherBody.lastToneTime || now - otherBody.lastToneTime > 150) {
        otherBody.lastToneTime = now;
        lastCollisionTime = now;
        const note = otherBody.assignedTone;

        // Immediate triggering with no scheduling delay
        otherBody.assignedSynth.triggerAttackRelease(note, "8n", undefined, 1);

        // Measure actual audio start time for latency calculation
        lastAudioStartTime = performance.now();
        measuredLatency = lastAudioStartTime - lastCollisionTime;

        latencyElem.innerText = `JS Latency: ${measuredLatency.toFixed(2)} ms`;

        updateRhythmUI(note); // Update UI for player-driven collision actions
      }
    }
  });

  // Define an expanded array of possible tones (across multiple octaves)
  const tones = [
    "C3",
    "D3",
    "E3",
    "F3",
    "G3",
    "A3",
    "B3",
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
    "A4",
    "B4",
    "C5",
    "D5",
    "E5",
  ];

  // New block configuration: 12 colours from a rainbow spectrum; each maps to a note (A–G) as described.
  type BlockConfig = {
    color: number;
    synth: string;
    size: number;
    tone: string;
  };

  // Define a rainbow palette of 12 colours (using a full circle in hue)
  const rainbowColors: number[] = [
    0xff0000, // red  (index 0)
    0xff7f00, // orange (index 1)
    0xffff00, // yellow (index 2)
    0x7fff00, // chartreuse (index 3)
    0x00ff00, // green (index 4)
    0x00ff7f, // spring green (index 5)
    0x00ffff, // cyan (index 6)
    0x007fff, // azure (index 7)
    0x0000ff, // blue (index 8)
    0x4b0082, // indigo (index 9)
    0x8a2be2, // blue-violet (index 10)
    0x8b00ff, // violet (index 11) -> will map to note G per spec
  ];

  // Define a mapping from each of the 12 colour indices to a note.
  // Using standard 12-tone chromatic scale starting on C
  const noteMapping: string[] = [
    "C",  // index 0
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  // Defensive check to ensure we have exactly 12 colors and 12 notes
  if (rainbowColors.length !== 12 || noteMapping.length !== 12) {
    console.error("Expected 12 colors and 12 notes for chromatic scale. Check your configuration.");
  }

  // Allowed block sizes (only 4 sizes); the size determines the octave.
  const allowedSizes: number[] = [1.0, 2.0, 3.0, 4.0];

  // Map from block size to octave: 1.0 => octave 5, 2.0 => octave 4, 3.0 => octave 3, 4.0 => octave 2.
  const sizeToOctave: Record<number, number> = {
    1.0: 5,
    2.0: 4,
    3.0: 3,
    4.0: 2,
  };

  // Generate a randomized sequence of 150 block configurations.
  const blockSequence: BlockConfig[] = [];
  for (let i = 0; i < 150; i++) {
    // Randomly choose a colour index between 0 and 11.
    const colorIndex = Math.floor(Math.random() * rainbowColors.length);
    const chosenColor = rainbowColors[colorIndex];
    const noteLetter = noteMapping[colorIndex];

    // Randomly pick one of the allowed sizes.
    const chosenSize =
      allowedSizes[Math.floor(Math.random() * allowedSizes.length)];
    // Determine octave from size.
    const octave = sizeToOctave[chosenSize];
    // Full tone is the note letter concatenated with the octave.
    const fullTone = noteLetter + octave.toString();

    blockSequence.push({
      color: chosenColor,
      synth: "MetalSynth", // All blocks use MetalSynth
      size: chosenSize,
      tone: fullTone,
    });
  }
  // Global pointer for sequentially drawing from blockSequence
  let blockSeqIndex = 0;

  // Define global synth configuration object with optimized envelopes for low latency
  const synthConfigs: Record<string, any> = {
    Synth: {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 }, // Faster attack
    },
    MetalSynth: {
      // For example, use MembraneSynth defaults with faster attack:
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
    },
  };

  // Pre-allocate all audio processing nodes to avoid instantiation during gameplay
  const globalLimiter = new TONE.Limiter(-12);
  globalLimiter.toDestination();

  // Pre-allocate a pool of synths for immediate use
  const synthPool = {
    Synth: Array(10)
      .fill(0)
      .map(() => new TONE.Synth(synthConfigs.Synth)),
    MetalSynth: Array(10)
      .fill(0)
      .map(() => new TONE.MembraneSynth(synthConfigs.MetalSynth)),
    FMSynth: Array(5)
      .fill(0)
      .map(() => new TONE.FMSynth(synthConfigs.FMSynth)),
    AMSynth: Array(5)
      .fill(0)
      .map(() => new TONE.AMSynth(synthConfigs.AMSynth)),
  };

  // Connect all synths to the limiter but keep them silent until needed
  Object.values(synthPool)
    .flat()
    .forEach((synth) => {
      synth.connect(globalLimiter);
      synth.volume.value = -Infinity; // Silent until used
    });

  // Pre-allocate audio processing nodes for reuse
  const filterPool = Array(30)
    .fill(0)
    .map(() => new TONE.Filter(400, "lowpass"));
  const pannerPool = Array(30)
    .fill(0)
    .map(
      () =>
        new TONE.Panner3D({
          panningModel: "HRTF",
          distanceModel: "inverse",
          refDistance: 1,
          maxDistance: 50,
          rolloffFactor: 0.3,
          coneInnerAngle: 360,
          coneOuterAngle: 0,
          coneOuterGain: 0,
        }),
    );
  const volumePool = Array(30)
    .fill(0)
    .map(() => new TONE.Volume(-12));

  // Track which nodes are in use
  const usedNodes = {
    filters: Array(30).fill(false),
    panners: Array(30).fill(false),
    volumes: Array(30).fill(false),
    synths: {
      Synth: Array(10).fill(false),
      MetalSynth: Array(10).fill(false),
      FMSynth: Array(5).fill(false),
      AMSynth: Array(5).fill(false),
    },
  };

  // Helper function to create the audio chain for a given synth type.
  function buildSynthChain(chosenType: string): {
    synth:
      | TONE.Synth
      | TONE.MetalSynth
      | TONE.PluckSynth
      | TONE.FMSynth
      | TONE.AMSynth;
    bassFilter: TONE.Filter;
    spatialVolume: TONE.Volume;
    panner3D: TONE.Panner3D;
  } {
    // Get available synth from pool
    let boxSynth;
    let synthIndex = -1;

    if (chosenType === "Synth") {
      synthIndex = usedNodes.synths.Synth.findIndex((used) => !used);
      if (synthIndex >= 0) {
        usedNodes.synths.Synth[synthIndex] = true;
        boxSynth = synthPool.Synth[synthIndex];
      } else {
        console.warn("No available Synth in pool; instantiating a new one.");
        boxSynth = new TONE.Synth(synthConfigs.Synth);
      }
    } else if (chosenType === "MetalSynth") {
      synthIndex = usedNodes.synths.MetalSynth.findIndex((used) => !used);
      if (synthIndex >= 0) {
        usedNodes.synths.MetalSynth[synthIndex] = true;
        boxSynth = synthPool.MetalSynth[synthIndex];
      } else {
        console.warn("No available MetalSynth in pool; instantiating a new one.");
        boxSynth = new TONE.MembraneSynth(synthConfigs.MetalSynth);
      }
    } else if (chosenType === "FMSynth") {
      synthIndex = usedNodes.synths.FMSynth.findIndex((used) => !used);
      if (synthIndex >= 0) {
        usedNodes.synths.FMSynth[synthIndex] = true;
        boxSynth = synthPool.FMSynth[synthIndex];
      } else {
        console.warn("No available FMSynth in pool; instantiating a new one.");
        boxSynth = new TONE.FMSynth(synthConfigs.FMSynth);
      }
    } else if (chosenType === "AMSynth") {
      synthIndex = usedNodes.synths.AMSynth.findIndex((used) => !used);
      if (synthIndex >= 0) {
        usedNodes.synths.AMSynth[synthIndex] = true;
        boxSynth = synthPool.AMSynth[synthIndex];
      } else {
        console.warn("No available AMSynth in pool; instantiating a new one.");
        boxSynth = new TONE.AMSynth(synthConfigs.AMSynth);
      }
    } else if (chosenType === "PluckSynth") {
      console.warn("PluckSynth not in pool; instantiating a new one.");
      boxSynth = new TONE.PluckSynth(synthConfigs.PluckSynth);
    }

    // Get available filter, panner, and volume from pools
    const filterIndex = usedNodes.filters.findIndex((used) => !used);
    const pannerIndex = usedNodes.panners.findIndex((used) => !used);
    const volumeIndex = usedNodes.volumes.findIndex((used) => !used);

    const bassFilter =
      filterIndex >= 0
        ? filterPool[filterIndex]
        : new TONE.Filter(400, "lowpass");
    const panner3D =
      pannerIndex >= 0
        ? pannerPool[pannerIndex]
        : new TONE.Panner3D({
            panningModel: "HRTF",
            distanceModel: "inverse",
            refDistance: 1,
            maxDistance: 50,
            rolloffFactor: 0.3,
            coneInnerAngle: 360,
            coneOuterAngle: 0,
            coneOuterGain: 0,
          });
    const spatialVolume =
      volumeIndex >= 0 ? volumePool[volumeIndex] : new TONE.Volume(-12);

    if (filterIndex >= 0) usedNodes.filters[filterIndex] = true;
    if (pannerIndex >= 0) usedNodes.panners[pannerIndex] = true;
    if (volumeIndex >= 0) usedNodes.volumes[volumeIndex] = true;

    // Reset volume to default
    spatialVolume.volume.value = -12;

    // Connect the chain
    boxSynth.disconnect();
    boxSynth.chain(bassFilter, panner3D, spatialVolume, globalLimiter);

    // Reset volume from -Infinity (dormant state) to 0 for audible output
    boxSynth.volume.value = 0;

    return { synth: boxSynth, bassFilter, spatialVolume, panner3D };
  }

  // Helper function to compute volume based on distance and impact velocity
  function computeCollisionVolume(
    mesh: THREE.Mesh,
    camera: THREE.Camera,
    impactVelocity: number,
  ): number {
    const diff = new THREE.Vector3().subVectors(mesh.position, camera.position);
    const distance = diff.length();
    const maxDistance = 50;
    const volumeFactor = Math.max(0, 1 - distance / maxDistance);
    let computedVolume = -12 - (1 - volumeFactor) * 20;
    return Math.min(computedVolume + impactVelocity * 2, 0);
  }

  // Track audio latency for debugging
  let lastCollisionTime = 0;
  let lastAudioStartTime = 0;
  let measuredLatency = 0;

  // Helper for collision handling; ensures the block flashes and triggers its sound.
  function attachCollisionHandler(boxBody: CANNON.Body, mesh: THREE.Mesh) {
    boxBody.addEventListener("collide", (e: any) => {
      // Only proceed if the block collided with the player body
      if (e.body !== playerBody) return;

      const impactVelocity =
        e.contact && e.contact.getImpactVelocityAlongNormal
          ? e.contact.getImpactVelocityAlongNormal()
          : 0;
      if (impactVelocity < 2) return;

      const originalColor = mesh.userData.originalColor;
      mesh.material.color.set(0xffffff);
      setTimeout(() => {
        mesh.material.color.setHex(originalColor);
      }, 150);

      (boxBody as any).assignedVolume.volume.value = computeCollisionVolume(
        mesh,
        camera,
        impactVelocity,
      );

      const now = performance.now();
      if (now - (boxBody as any).lastToneTime > 150) {
        (boxBody as any).lastToneTime = now;
        lastCollisionTime = now;
        const note = (boxBody as any).assignedTone;

        // Immediate triggering with no scheduling delay
        (boxBody as any).assignedSynth.triggerAttackRelease(
          note,
          "8n",
          undefined,
          1,
        );

        // Measure actual audio start time for latency calculation
        lastAudioStartTime = performance.now();
        measuredLatency = lastAudioStartTime - lastCollisionTime;

        latencyElem.innerText = `JS Latency: ${measuredLatency.toFixed(2)} ms`;

        updateRhythmUI(note); // Only updated if the collision involves the player
      }
    });
  }

  // Helper to create a block with its mesh, physics body, audio chain and collision handling.
  function createBlock(
    position: THREE.Vector3,
    config: BlockConfig,
  ): { mesh: THREE.Mesh; body: CANNON.Body } {
    const boxSize = config.size; // Use the discrete size from config
    const assignedTone = config.tone; // Use the corresponding tone
    // Create box geometry using the provided size
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    // Use the synth type from config
    const chosenType = config.synth;
    // Use the color from config for the material, and make it glow as a light emitter
    const boxMat = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.4,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.userData.originalColor = config.color;
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    const edges = new THREE.EdgesGeometry(boxGeo);
    const outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 10 }),
    );
    boxMesh.add(outline);
    boxMesh.userData.outline = outline;
    boxMesh.position.copy(position);

    const halfExtents = new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2);
    const boxShape = new CANNON.Box(halfExtents);
    const boxBody = new CANNON.Body({ mass: 1 });
    boxBody.addShape(boxShape);
    boxBody.position.copy(new CANNON.Vec3(position.x, position.y, position.z));

    (boxBody as any).mesh = boxMesh;
    boxMesh.userData.boxBody = boxBody;
    (boxBody as any).assignedTone = assignedTone;

    // Use the provided synth type when building the audio chain.
    const { synth, panner3D, spatialVolume } = buildSynthChain(chosenType);
    (boxBody as any).assignedSynth = synth;
    (boxBody as any).assignedPanner3D = panner3D;
    (boxBody as any).assignedVolume = spatialVolume;
    (boxBody as any).lastToneTime = 0;

    attachCollisionHandler(boxBody, boxMesh);

    return { mesh: boxMesh, body: boxBody };
  }

  // Create a global array to store box meshes
  const boxMeshArray: THREE.Mesh[] = [];

  // Create and style a block counter element
  const blockCounterElem = document.createElement("div");
  blockCounterElem.id = "blockCounter";
  blockCounterElem.style.position = "absolute";
  blockCounterElem.style.top = "10px";
  blockCounterElem.style.right = "10px"; // Changed from left to right
  blockCounterElem.style.color = "white";
  blockCounterElem.style.fontSize = "18px";
  blockCounterElem.style.fontFamily = "Roboto, sans-serif"; // New font-family
  document.body.appendChild(blockCounterElem);

  // Create BPM display element below the block counter
  const bpmElem = document.createElement("div");
  bpmElem.id = "bpmDisplay";
  bpmElem.style.position = "absolute";
  bpmElem.style.top = "40px";
  bpmElem.style.right = "10px";
  bpmElem.style.color = "white";
  bpmElem.style.fontSize = "18px";
  bpmElem.style.fontFamily = "Roboto, sans-serif";
  document.body.appendChild(bpmElem);

  // Create new UI element for timing accuracy (difference to nearest measure in ms)
  const timingAccuracyElem = document.createElement("div");
  timingAccuracyElem.id = "timingAccuracy";
  timingAccuracyElem.style.position = "absolute";
  timingAccuracyElem.style.top = "70px";
  timingAccuracyElem.style.right = "10px";
  timingAccuracyElem.style.color = "white";
  timingAccuracyElem.style.fontSize = "18px";
  timingAccuracyElem.style.fontFamily = "Roboto, sans-serif";
  document.body.appendChild(timingAccuracyElem);

  // Create new UI element for last triggered note
  const lastNoteElem = document.createElement("div");
  lastNoteElem.id = "lastNote";
  lastNoteElem.style.position = "absolute";
  lastNoteElem.style.top = "100px";
  lastNoteElem.style.right = "10px";
  lastNoteElem.style.color = "white";
  lastNoteElem.style.fontSize = "18px";
  lastNoteElem.style.fontFamily = "Roboto, sans-serif";
  document.body.appendChild(lastNoteElem);

  // Function to update the counter text
  function updateBlockCounter() {
    blockCounterElem.innerText = `Blocks: ${boxMeshArray.length}`;
  }
  updateBlockCounter();

  // Create a round timer element at the top center of the screen
  const roundTimerElem = document.createElement("div");
  roundTimerElem.id = "roundTimer";
  roundTimerElem.style.position = "absolute";
  roundTimerElem.style.top = "10px";
  roundTimerElem.style.left = "50%";
  roundTimerElem.style.transform = "translateX(-50%)";
  roundTimerElem.style.color = "white";
  roundTimerElem.style.fontSize = "24px";
  roundTimerElem.style.fontFamily = "Roboto, sans-serif";
  document.body.appendChild(roundTimerElem);

  // Create latency display element for debugging
  const latencyElem = document.createElement("div");
  latencyElem.id = "latencyDisplay";
  latencyElem.style.position = "absolute";
  latencyElem.style.top = "130px";
  latencyElem.style.right = "10px";
  latencyElem.style.color = "white";
  latencyElem.style.fontSize = "18px";
  latencyElem.style.fontFamily = "Roboto, sans-serif";
  document.body.appendChild(latencyElem);

  // Seed the arena with 30 blocks at the start of the round
  for (let i = 0; i < 30; i++) {
    spawnBlock();
  }

  // Schedule block spawning: add one block every bar (1 measure) until the round ends
  transport.scheduleRepeat(spawnBlock, "1m");

  function spawnBlock() {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 40,
      50,
      (Math.random() - 0.5) * 40,
    );
    // Pull the next block configuration from blockSequence
    const config = blockSequence[blockSeqIndex];
    blockSeqIndex = (blockSeqIndex + 1) % blockSequence.length;
    const { mesh, body } = createBlock(pos, config);
    scene.add(mesh);
    world.addBody(body);
    boxMeshArray.push(mesh);
    updateBlockCounter();
  }

  function createTickerBlock() {
    const size = 1; // ticker block dimensions
    const tickerColor = 0x808080; // gray
    const blockGeo = new THREE.BoxGeometry(size, size, size);
    const blockMat = new THREE.MeshStandardMaterial({
      color: tickerColor,
      emissive: tickerColor,
      emissiveIntensity: 0.4,
    });
    const blockMesh = new THREE.Mesh(blockGeo, blockMat);
    blockMesh.userData.originalColor = tickerColor;
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    // Position the block at the center of the arena (x:0, z:0) and half its height above ground
    blockMesh.position.set(0, size / 2, 0);
    scene.add(blockMesh);

    // Create a static physics body (mass 0 so it remains immovable)
    const halfExtents = new CANNON.Vec3(size / 2, size / 2, size / 2);
    const boxShape = new CANNON.Box(halfExtents);
    const boxBody = new CANNON.Body({ mass: 0 });
    boxBody.addShape(boxShape);
    boxBody.position.set(0, size / 2, 0);
    world.addBody(boxBody);

    // Build an audio chain for the ticker block using a percussive click sound.
    // We use a MembraneSynth with a very short envelope for a click-like effect.
    const tickerSynth = new TONE.MembraneSynth({
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
      },
    });
    const tickerFilter = new TONE.Filter(800, "lowpass");
    const tickerVolume = new TONE.Volume(0);
    const tickerPanner = new TONE.Panner3D({
      panningModel: "HRTF",
      distanceModel: "inverse",
      refDistance: 1,
      maxDistance: 50,
      rolloffFactor: 0.3, // reduced falloff intensity for the ticker block
      coneInnerAngle: 360,
      coneOuterAngle: 0,
      coneOuterGain: 0,
    });
    tickerSynth.chain(tickerFilter, tickerPanner, tickerVolume, globalLimiter);
    // Save the ticker synth and panner with the physics body if needed later
    (boxBody as any).assignedSynth = tickerSynth;
    (boxBody as any).assignedPanner3D = tickerPanner;

    // Schedule ticker block flashing and click sound every 2 measures (2 bars in 4/4 time)
    transport.scheduleRepeat((time) => {
      blockMesh.material.color.set(0xffffff);
      setTimeout(() => {
        blockMesh.material.color.setHex(tickerColor);
      }, 100);
      tickerSynth.triggerAttackRelease("C4", "8n", time);
      console.log(
        "Ticker block triggered at position:",
        blockMesh.position,
        "sound: C4 click",
      );
    }, "2m");

    return { mesh: blockMesh, body: boxBody };
  }

  // Add ticker block at the center of the arena for debugging
  const tickerBlock = createTickerBlock();

  // --- Start of round timer and tempo track setup ---
  const roundDuration = 120; // in seconds (2 minutes)
  const roundStartTime = performance.now();

  // Set initial tempo and ramp BPM to 180 over the round duration
  transport.bpm.value = 100;
  transport.bpm.rampTo(180, roundDuration);

  // Start the Tone.Transport (which drives scheduled events and BPM changes)
  transport.start();

  // Update the round timer element every 100ms
  const roundTimerInterval = setInterval(() => {
    const elapsed = (performance.now() - roundStartTime) / 1000;
    const remaining = Math.max(0, roundDuration - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    roundTimerElem.innerText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    if (remaining <= 0) {
      clearInterval(roundTimerInterval);
      // Optionally, stop the round or perform cleanup here:
      TONE.getTransport().stop();
      console.log("Round ended.");
    }
  }, 100);

  // Pre-allocate metronome synth with optimized settings for low latency
  const metronomeSynth = new TONE.MembraneSynth({
    volume: 0,
    envelope: {
      attack: 0.001,
      decay: 0.001,
      sustain: 0.001,
      release: 0.001,
    },
  });

  // Connect the metronome to the global limiter
  metronomeSynth.chain(globalLimiter);

  transport.scheduleRepeat((time) => {
    // Trigger a higher-pitched click (C4) for improved audibility
    metronomeSynth.triggerAttackRelease("C4", "16n", time);
  }, "4n");
  // --- End of round timer and tempo track setup ---

  // Movement variables
  const keys: Record<string, boolean> = {
    w: false,
    a: false,
    s: false,
    d: false,
  };

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = true;
    }
    // Check for spacebar jump (using a downward raycast to allow jumps off any surface)
    if (event.code === "Space") {
      const playerRadius = 1; // using same value as the sphere shape for the player
      const downRaycaster = new THREE.Raycaster();
      const origin = playerBody.position.clone();
      // Set ray downward (0, -1, 0)
      downRaycaster.set(origin, new THREE.Vector3(0, -1, 0));

      // Include the ground mesh and all block meshes in the raycast
      const intersectObjects = [groundMesh, ...boxMeshArray];
      const intersects = downRaycaster.intersectObjects(intersectObjects);

      // Use a threshold of (playerRadius + small epsilon) for grounding
      if (
        intersects.length > 0 &&
        intersects[0].distance <= playerRadius + 0.2
      ) {
        // Trigger the jump with increased power (sound removed)
        playerBody.velocity.y = 9; // 50% of 18 for a weaker jump

        // If jumping off a block (non-ground), apply a stronger reaction impulse to it
        if (intersects[0].object.userData.boxBody) {
          const blockBody = intersects[0].object.userData.boxBody;
          // Apply a downward impulse to simulate the push-off effect (adjust impulse magnitude as needed)
          blockBody.applyImpulse(new CANNON.Vec3(0, -7, 0), blockBody.position);
        }
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = false;
    }
  });

  // Create crosshair element
  const crosshairElem = document.createElement("div");
  crosshairElem.id = "crosshair";
  crosshairElem.style.position = "absolute";
  crosshairElem.style.top = "50%";
  crosshairElem.style.left = "50%";
  crosshairElem.style.transform = "translate(-50%, -50%)";
  crosshairElem.style.width = "20px";
  crosshairElem.style.height = "20px";
  crosshairElem.style.border = "2px solid white";
  crosshairElem.style.borderRadius = "50%";
  document.body.appendChild(crosshairElem);

  // Initialize raycaster for block click detection
  const raycaster = new THREE.Raycaster();

  // Add Stats.js for performance monitoring
  const stats = Stats();
  document.body.appendChild(stats.dom);

  // Add event listener for click tests
  renderer.domElement.addEventListener("mouseup", (event) => {
    // Only proceed if pointer is locked
    if (!controls.isLocked) return;

    // Cast a ray from the center of the screen.
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    // Intersect with all objects in the scene (use recursive flag to catch children like outlines)
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      // Find the intersected block mesh.
      let targetMesh = intersects[0].object;
      // If the clicked object is a child (like an outline), check its parent.
      if (!targetMesh.userData.boxBody && targetMesh.parent) {
        targetMesh = targetMesh.parent;
      }
      if (targetMesh.userData.boxBody) {
        // Log block info for debugging.
        console.log("Block clicked:", targetMesh);
        console.log("Position:", targetMesh.position);
        const blockBody = targetMesh.userData.boxBody as CANNON.Body;
        console.log("Assigned tone:", (blockBody as any).assignedTone);
        console.log("Assigned synth:", (blockBody as any).assignedSynth);

        // Flash the block white (store original color first).
        const originalColor = targetMesh.userData.originalColor;
        // Store the original emissive intensity.
        const originalEmissiveIntensity = targetMesh.material.emissiveIntensity;
        // Flash: Override color and emissive properties to white.
        targetMesh.material.color.set(0xffffff);
        targetMesh.material.emissive.set(0xffffff);
        targetMesh.material.emissiveIntensity = 2;
        setTimeout(() => {
          // Restore the original color and glow settings.
          targetMesh.material.color.setHex(originalColor);
          targetMesh.material.emissive.setHex(originalColor);
          targetMesh.material.emissiveIntensity = 0.4;
        }, 150);

        // Play the block sound with a "big impact" (simulate high impact velocity).
        // Use a high volume version by overriding the computed volume if desired.
        const note = (blockBody as any).assignedTone;
        lastCollisionTime = performance.now();

        // Immediate triggering with no scheduling delay
        (blockBody as any).assignedSynth.triggerAttackRelease(
          note,
          "8n",
          undefined,
          1,
        );

        // Measure actual audio start time for latency calculation
        lastAudioStartTime = performance.now();
        measuredLatency = lastAudioStartTime - lastCollisionTime;
        latencyElem.innerText = `Audio Latency: ${measuredLatency.toFixed(2)} ms`;

        updateRhythmUI(note);
      }
    }
  });

  // Helper function to update Tone.js listener position and orientation
  function updateToneListener(camera: THREE.Camera): void {
    const context = TONE.getContext();
    context.listener.positionX.value = camera.position.x;
    context.listener.positionY.value = camera.position.y;
    context.listener.positionZ.value = camera.position.z;

    const listenerForward = new THREE.Vector3();
    camera.getWorldDirection(listenerForward).normalize();
    const up = camera.up;
    context.listener.forwardX.value = listenerForward.x;
    context.listener.forwardY.value = listenerForward.y;
    context.listener.forwardZ.value = listenerForward.z;
    context.listener.upX.value = up.x;
    context.listener.upY.value = up.y;
    context.listener.upZ.value = up.z;
  }

  // Helper function to compute timing accuracy and update UI
  function updateRhythmUI(note: string) {
    // Get the current BPM from the cached transport.
    const currentBPM = transport.bpm.value;
    // In 4/4 time, one measure's length = (60 / BPM) * 4.
    // But we want the nearest eighth note boundary – an eighth note lasts (60 / BPM) / 2.
    const eighthNoteLength = 60 / currentBPM / 2; // seconds per 8th note
    // Get current transport time in seconds.
    const currentTransportTime = transport.seconds;
    // Compute remainder of current eighth note period:
    const mod = currentTransportTime % eighthNoteLength;
    // The timing accuracy is the smallest difference (either mod or the remainder to the next boundary).
    const diff = Math.min(mod, eighthNoteLength - mod);
    const diffMs = Math.round(diff * 1000);

    // Calculate percentage accuracy (100% = perfect timing)
    const maxDeviation = (eighthNoteLength / 2) * 1000; // Half an eighth note in ms is the worst case
    const accuracyPercent = 100 - (diffMs / maxDeviation) * 100;
    const accuracyText =
      accuracyPercent > 90
        ? "Excellent!"
        : accuracyPercent > 75
          ? "Good"
          : accuracyPercent > 50
            ? "OK"
            : "Off-beat";

    timingAccuracyElem.innerText = `Timing: ${diffMs} ms (${accuracyText})`;
    lastNoteElem.innerText = `Last Note: ${note}`;
  }

  // Track time for physics updates
  let lastTime = performance.now();

  // Animation loop
  function animate() {
    stats.update();

    // Step the physics world with variable time step
    const currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000; // delta in seconds
    lastTime = currentTime;
    // Advance the physics with a fixed time step (1/60) using accumulated dt and allow for up to 3 substeps.
    world.step(1 / 60, dt, 3);
    requestAnimationFrame(animate);

    // Update camera position to match the player's physics body
    if (controls.isLocked) {
      camera.position.copy(playerBody.position as unknown as THREE.Vector3);
    }

    // Basic WASD movement: calculate front and side speeds
    const speed = 48; // 20% faster than 40
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    // Compute horizontal forward by zeroing the Y component
    const horizForward = camDir.clone().setY(0).normalize();
    // Compute right vector: cross(up, forward) yields the right direction
    const right = new THREE.Vector3()
      .crossVectors(camera.up, horizForward)
      .normalize();

    let moveX = 0;
    let moveZ = 0;
    if (keys.w) moveZ += 1; // W now moves forward
    if (keys.s) moveZ -= 1; // S now moves backward
    if (keys.a) moveX += 1; // A now strafes left (relative to camera)
    if (keys.d) moveX -= 1; // D now strafes right

    const velocity = new CANNON.Vec3();
    if (moveZ !== 0 || moveX !== 0) {
      const moveDir = new THREE.Vector3();
      moveDir
        .add(horizForward.multiplyScalar(moveZ))
        .add(right.multiplyScalar(moveX));
      moveDir.normalize().multiplyScalar(speed);
      velocity.x = moveDir.x;
      velocity.z = moveDir.z;
    }
    // Preserve Y-velocity (gravity/jump)
    playerBody.velocity.x = velocity.x;
    playerBody.velocity.z = velocity.z;

    // Update boxes' Three.js meshes from their Cannon bodies
    world.bodies.forEach((body) => {
      if ((body as any).mesh) {
        const mesh = (body as any).mesh as THREE.Mesh;
        mesh.position.copy(body.position as unknown as THREE.Vector3);
        mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);

        // Update the 3D panner position to match the body position
        if ((body as any).assignedPanner3D) {
          const panner = (body as any).assignedPanner3D as TONE.Panner3D;
          panner.positionX.value = body.position.x;
          panner.positionY.value = body.position.y;
          panner.positionZ.value = body.position.z;
        }
      }
    });

    // Update Tone.js listener position and orientation to match the camera
    updateToneListener(camera);

    // Update BPM display
    bpmElem.innerText = `BPM: ${transport.bpm.value.toFixed(0)}`;

    // Animate sun position and color over the round duration
    const elapsedRound = (performance.now() - roundStartTime) / 1000;
    const t = Math.min(elapsedRound / roundDuration, 1); // normalized time (0 to 1)

    if (t <= 0.5) {
      // First half of the round: from start to mid (noon)
      const factor = t / 0.5;
      sun.position.lerpVectors(startPos, midPos, factor);
      sun.color.copy(startColor.clone().lerp(midColor, factor));
    } else {
      // Second half of the round: from mid to end (sunset)
      const factor = (t - 0.5) / 0.5;
      sun.position.lerpVectors(midPos, endPos, factor);
      sun.color.copy(midColor.clone().lerp(endColor, factor));
    }

    // Update the visible sun sphere position and color to match the directional light
    sunSphere.position.copy(sun.position);
    sunSphere.material.color.copy(sun.color);

    // Gradual day-night cycle: Extend sunrise/sunset to 30 seconds at boundaries.
    if (elapsedRound < 30) {
      // Sunrise: interpolate from black to dawnSkyColor.
      const factor = elapsedRound / 30;
      scene.background = new THREE.Color(0x000000).lerp(dawnSkyColor, factor);
      sun.intensity = factor * 2.5;
      sunSphere.visible = factor > 0.2;
    } else if (elapsedRound > roundDuration - 30) {
      // Sunset: interpolate from dawnSkyColor to black.
      const factor = (roundDuration - elapsedRound) / 30;
      scene.background = dawnSkyColor
        .clone()
        .lerp(new THREE.Color(0x000000), 1 - factor);
      sun.intensity = factor * 2.5;
      sunSphere.visible = factor > 0.2;
    } else {
      // Daytime: keep a steady noon sky and full sun intensity.
      scene.background = noonSkyColor;
      sun.intensity = 2.5;
      sunSphere.visible = true;
    }

    // Ramp metronome volume: quiet/peaceful at round start, louder/more aggressive at the end.
    const metStartVol = -30; // very quiet at start (in dB)
    const metEndVol = -6; // much louder at round end
    metronomeSynth.volume.value = metStartVol + (metEndVol - metStartVol) * t;

    renderer.render(scene, camera);
  }

  animate();

  // Remove loading text once the game is loaded
  const loadingElem = document.getElementById("loading");
  if (loadingElem) {
    loadingElem.remove();
  }

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Start the game
init().catch(console.error);
