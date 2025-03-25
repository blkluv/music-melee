// Music Melee - Main Entry Point
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TONE from "tone";
import * as CANNON from "cannon-es";

// Initialize the game
async function init() {
  console.log("Music Melee initializing...");

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
        console.log("Tone.js audio context resumed");
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

  // Hemisphere light for ambient sky illumination
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

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

  // Directional light to simulate the sun (with stronger intensity)
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(50, 30, -50);
  sun.castShadow = true;
  // Optionally adjust shadow properties for more realism:
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  scene.add(sun);

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
      mesh.material.color.set(0xffffff);
      setTimeout(() => {
        mesh.material.color.setHex(originalColor);
      }, 150);

      // Compute impact velocity (if available) and ignore very soft collisions
      const impactVelocity =
        e.contact && e.contact.getImpactVelocityAlongNormal
          ? e.contact.getImpactVelocityAlongNormal()
          : 0;
      if (impactVelocity < 2) return;

      // Compute spatial audio parameters similar to the block's own collision effect:
      const diff = new THREE.Vector3().subVectors(
        mesh.position,
        camera.position,
      );
      const distance = diff.length();
      const maxDistance = 50;
      const volumeFactor = Math.max(0, 1 - distance / maxDistance);
      let computedVolume = -12 - (1 - volumeFactor) * 20;
      computedVolume = Math.min(computedVolume + impactVelocity * 2, 0);
      const cameraRight = new THREE.Vector3();
      cameraRight
        .crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3()))
        .normalize();
      // Note: The 3D panner position is updated in the animation loop, so no need to set pan manually.
      otherBody.assignedVolume.volume.value = computedVolume;

      // Use a simple cooldown check:
      const now = performance.now();
      if (!otherBody.lastToneTime || now - otherBody.lastToneTime > 150) {
        otherBody.lastToneTime = now;
        otherBody.assignedSynth.triggerAttackRelease(
          otherBody.assignedTone,
          "8n",
        );
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

  // Define synth types and their corresponding colors
  const synthTypes = [
    "Synth",
    "MetalSynth",
    "PluckSynth",
    "FMSynth",
    "AMSynth",
  ];
  const synthColorMap: Record<string, number> = {
    Synth: 0xff0000, // red
    MetalSynth: 0x00ff00, // green
    PluckSynth: 0x0000ff, // blue
    FMSynth: 0xffff00, // yellow
    AMSynth: 0xff00ff, // magenta
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
    let boxSynth;
    if (chosenType === "Synth") {
      boxSynth = new TONE.Synth({ oscillator: { type: "sine" } });
    } else if (chosenType === "MetalSynth") {
      boxSynth = new TONE.MembraneSynth();
    } else if (chosenType === "PluckSynth") {
      boxSynth = new TONE.PluckSynth();
    } else if (chosenType === "FMSynth") {
      boxSynth = new TONE.FMSynth();
    } else if (chosenType === "AMSynth") {
      boxSynth = new TONE.AMSynth();
    }
    const bassFilter = new TONE.Filter(400, "lowpass");
    const spatialVolume = new TONE.Volume(-12);
    const panner3D = new TONE.Panner3D({
      panningModel: "HRTF",
      distanceModel: "inverse",
      refDistance: 1,
      maxDistance: 50,
      rolloffFactor: 0.3, // reduced falloff intensity
      coneInnerAngle: 360,
      coneOuterAngle: 0,
      coneOuterGain: 0,
    });
    boxSynth.chain(bassFilter, panner3D, spatialVolume, TONE.Destination);
    return { synth: boxSynth, bassFilter, spatialVolume, panner3D };
  }

  // Helper for collision handling; ensures the block flashes and triggers its sound.
  function attachCollisionHandler(boxBody: CANNON.Body, mesh: THREE.Mesh) {
    boxBody.addEventListener("collide", (e: any) => {
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

      const diff = new THREE.Vector3().subVectors(
        mesh.position,
        camera.position,
      );
      const distance = diff.length();
      const maxDistance = 50;
      const volumeFactor = Math.max(0, 1 - distance / maxDistance);
      let computedVolume = -12 - (1 - volumeFactor) * 20;
      computedVolume = Math.min(computedVolume + impactVelocity * 2, 0);

      (boxBody as any).assignedVolume.volume.value = computedVolume;

      const now = performance.now();
      if (now - (boxBody as any).lastToneTime > 150) {
        (boxBody as any).lastToneTime = now;
        (boxBody as any).assignedSynth.triggerAttackRelease(
          (boxBody as any).assignedTone,
          "8n",
        );
      }
    });
  }

  // Helper to create a block with its mesh, physics body, audio chain and collision handling.
  function createBlock(position: THREE.Vector3): {
    mesh: THREE.Mesh;
    body: CANNON.Body;
  } {
    const sizeMin = 0.3,
      sizeMax = 3.0;
    const boxSize = Math.random() * (sizeMax - sizeMin) + sizeMin;
    const normalized = (boxSize - sizeMin) / (sizeMax - sizeMin);
    const inverted = 1 - normalized;
    const toneIndex = Math.floor(inverted * (tones.length - 1));
    const assignedTone = tones[toneIndex];

    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const chosenType =
      synthTypes[Math.floor(Math.random() * synthTypes.length)];
    const boxMat = new THREE.MeshStandardMaterial({
      color: synthColorMap[chosenType],
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.userData.originalColor = synthColorMap[chosenType];
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

  // Spawn the initial boxes using the consolidated spawnBlock helper
  for (let i = 0; i < 20; i++) {
    spawnBlock();
  }

  // Schedule block spawning every 2 measures (4/4 time) via Tone.Transport
  TONE.Transport.scheduleRepeat(spawnBlock, "2m");

  function spawnBlock() {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 40,
      50,
      (Math.random() - 0.5) * 40,
    );
    const { mesh, body } = createBlock(pos);
    scene.add(mesh);
    world.addBody(body);
    boxMeshArray.push(mesh);
    updateBlockCounter();
  }


  function createTickerBlock() {
    const size = 2; // ticker block dimensions
    const tickerColor = 0x808080; // gray
    const blockGeo = new THREE.BoxGeometry(size, size, size);
    const blockMat = new THREE.MeshStandardMaterial({ color: tickerColor });
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
    tickerSynth.chain(
      tickerFilter,
      tickerPanner,
      tickerVolume,
      TONE.Destination,
    );
    // Save the ticker synth and panner with the physics body if needed later
    (boxBody as any).assignedSynth = tickerSynth;
    (boxBody as any).assignedPanner3D = tickerPanner;

    // Schedule ticker block flashing and click sound every 2 measures (2 bars in 4/4 time)
    TONE.Transport.scheduleRepeat(() => {
      blockMesh.material.color.set(0xffffff);
      setTimeout(() => {
        blockMesh.material.color.setHex(tickerColor);
      }, 100);
      tickerSynth.triggerAttackRelease("C4", "8n");
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
  TONE.Transport.bpm.value = 100;
  TONE.Transport.bpm.rampTo(180, roundDuration);

  // Start the Tone.Transport (which drives scheduled events and BPM changes)
  TONE.Transport.start();

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
      TONE.Transport.stop();
      console.log("Round ended.");
    }
  }, 100);

  // Create an audible metronome that triggers every quarter note
  const metronomeSynth = new TONE.MembraneSynth({
    volume: 6, // increase volume substantially (adjust as needed)
    envelope: {
      attack: 0.001,
      decay: 0.005, // even shorter decay for a sharper click
      sustain: 0,
      release: 0.02, // shorter release time
    },
  });
  TONE.Transport.scheduleRepeat(() => {
    // Trigger a higher-pitched click (C4) for improved audibility
    metronomeSynth.triggerAttackRelease("C4", "16n");
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
        targetMesh.material.color.set(0xffffff);
        setTimeout(() => {
          targetMesh.material.color.setHex(originalColor);
        }, 150);

        // Play the block sound with a "big impact" (simulate high impact velocity).
        // Use a high volume version by overriding the computed volume if desired.
        (blockBody as any).assignedSynth.triggerAttackRelease(
          (blockBody as any).assignedTone,
          "8n",
        );
      }
    }
  });

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
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // ignore vertical component
    forward.normalize();
    right.crossVectors(camera.up, forward).normalize();

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
        .add(forward.multiplyScalar(moveZ))
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

    // Update Tone.js listener position to match the camera/player
    TONE.getContext().listener.positionX.value = camera.position.x;
    TONE.getContext().listener.positionY.value = camera.position.y;
    TONE.getContext().listener.positionZ.value = camera.position.z;

    // Update listener orientation based on the camera's direction
    const listenerForward = new THREE.Vector3();
    camera.getWorldDirection(listenerForward);
    listenerForward.normalize();
    const up = camera.up;
    TONE.getContext().listener.forwardX.value = listenerForward.x;
    TONE.getContext().listener.forwardY.value = listenerForward.y;
    TONE.getContext().listener.forwardZ.value = listenerForward.z;
    TONE.getContext().listener.upX.value = up.x;
    TONE.getContext().listener.upY.value = up.y;
    TONE.getContext().listener.upZ.value = up.z;

    // Update BPM display
    bpmElem.innerText = `BPM: ${TONE.Transport.bpm.value.toFixed(0)}`;

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
