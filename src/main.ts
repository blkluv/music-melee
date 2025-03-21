// Music Melee - Main Entry Point
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import * as TONE from 'tone';
import * as CANNON from 'cannon-es';

// Initialize the game
async function init() {
  console.log('Music Melee initializing...');
  
  // Setup Three.js scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#87CEEB');
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  
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
    'click',
    async () => {
      if (TONE.getContext().state !== 'running') {
        await TONE.start();
        console.log('Tone.js audio context resumed');
      }
    },
    { once: true }
  );
  
  // Setup physics
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -20, 0)
  });
  
  // Initialize PointerLockControls for first-person navigation
  const controls = new PointerLockControls(camera, renderer.domElement);
  // Optionally, trigger pointer lock on a user gesture (e.g., a click)
  renderer.domElement.addEventListener('click', () => {
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
  function createWall(width: number, height: number, depth: number, pos: THREE.Vector3) {
    // Visual wall
    const wallGeo = new THREE.BoxGeometry(width, height, depth);
    const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
    wallMesh.position.copy(pos);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);
    
    // Create corresponding physics body (mass 0 for static)
    const halfExtents = new CANNON.Vec3(width/2, height/2, depth/2);
    const wallShape = new CANNON.Box(halfExtents);
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.addShape(wallShape);
    wallBody.position.set(pos.x, pos.y, pos.z);
    world.addBody(wallBody);
  }

  // Floor-level walls: center walls are raised so that their base sits on ground. Assume ground at y=0, so center wall at y = wallHeight/2

  // North wall (z = -halfArena)
  createWall(arenaSize, wallHeight, wallThickness, new THREE.Vector3(0, wallHeight/2, -halfArena));
  // South wall (z = halfArena)
  createWall(arenaSize, wallHeight, wallThickness, new THREE.Vector3(0, wallHeight/2, halfArena));
  // East wall (x = halfArena)
  createWall(wallThickness, wallHeight, arenaSize, new THREE.Vector3(halfArena, wallHeight/2, 0));
  // West wall (x = -halfArena)
  createWall(wallThickness, wallHeight, arenaSize, new THREE.Vector3(-halfArena, wallHeight/2, 0));

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
  
  // Create a kick drum synth for melee hits
  const kickSynth = new TONE.MembraneSynth().toDestination();
  
  const snareSynth = new TONE.MembraneSynth({
    pitchDecay: 0.05,
    oscillator: { type: "noise" },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
  }).toDestination();

  const rimshotSynth = new TONE.MembraneSynth({
    pitchDecay: 0.1,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0 }
  }).toDestination();
  
  const synth = new TONE.PolySynth(TONE.Synth).toDestination();
  
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
  
  playerBody.addEventListener('collide', (e: any) => {
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
      const diff = new THREE.Vector3().subVectors(mesh.position, camera.position);
      const distance = diff.length();
      const maxDistance = 50;
      const volumeFactor = Math.max(0, 1 - distance / maxDistance);
      let computedVolume = -12 - ((1 - volumeFactor) * 20);
      computedVolume = Math.min(computedVolume + impactVelocity * 2, 0);
      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
      const panValue = diff.dot(cameraRight) / distance;
    
      otherBody.assignedPanner.pan.value = panValue;
      otherBody.assignedVolume.volume.value = computedVolume;
    
      // Use a simple cooldown check:
      const now = performance.now();
      if (!otherBody.lastToneTime || now - otherBody.lastToneTime > 150) {
        otherBody.lastToneTime = now;
        otherBody.assignedSynth.triggerAttackRelease(otherBody.assignedTone, "8n");
      }
    }
  });
  
  // Define an expanded array of possible tones (across multiple octaves)
  const tones = [
    "C3", "D3", "E3", "F3", "G3", "A3", "B3",
    "C4", "D4", "E4", "F4", "G4", "A4", "B4",
    "C5", "D5", "E5"
  ];

  // Define synth types and their corresponding colors
  const synthTypes = ['Synth', 'MetalSynth', 'PluckSynth', 'FMSynth', 'AMSynth'];
  const synthColorMap: Record<string, number> = {
    'Synth': 0xff0000,      // red
    'MetalSynth': 0x00ff00, // green
    'PluckSynth': 0x0000ff, // blue
    'FMSynth': 0xffff00,    // yellow
    'AMSynth': 0xff00ff     // magenta
  };

  // Create a global array to store box meshes
  const boxMeshArray: THREE.Mesh[] = [];
  
  // Create and style a block counter element
  const blockCounterElem = document.createElement("div");
  blockCounterElem.id = "blockCounter";
  blockCounterElem.style.position = "absolute";
  blockCounterElem.style.top = "10px";
  blockCounterElem.style.right = "10px";  // Changed from left to right
  blockCounterElem.style.color = "white";
  blockCounterElem.style.fontSize = "18px";
  blockCounterElem.style.fontFamily = "Roboto, sans-serif";  // New font-family
  document.body.appendChild(blockCounterElem);

  // Function to update the counter text
  function updateBlockCounter() {
    blockCounterElem.innerText = `Blocks: ${boxMeshArray.length}`;
  }
  updateBlockCounter();
  
  // Create many boxes scattered about for a more dynamic environment
  const boxCount = 20; // reduced number of boxes as per new requirements
  for (let i = 0; i < boxCount; i++) {
    // Create the Three.js mesh for the box
    const boxSize = Math.random() * (3.0 - 0.3) + 0.3; // size between 0.3 and 3.0
    
    // Calculate tone based on box size
    const sizeMin = 0.3, sizeMax = 3.0;
    const normalized = (boxSize - sizeMin) / (sizeMax - sizeMin); // 0 for smallest, 1 for largest
    const inverted = 1 - normalized; // invert so smaller size => higher value
    const toneIndex = Math.floor(inverted * (tones.length - 1));
    const assignedTone = tones[toneIndex];
    
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    
    // Choose a synth type and assign corresponding color
    const chosenType = synthTypes[Math.floor(Math.random() * synthTypes.length)];
    const boxMat = new THREE.MeshStandardMaterial({ color: synthColorMap[chosenType] });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.userData.originalColor = synthColorMap[chosenType];
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    // Add black outline
    const edges = new THREE.EdgesGeometry(boxGeo);
    const outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 10 })
    );
    boxMesh.add(outline);
    // Random placement: x and z between -20 and 20; y slightly above ground
    boxMesh.position.set((Math.random() - 0.5) * 40, boxSize / 2, (Math.random() - 0.5) * 40);
    scene.add(boxMesh);
    boxMeshArray.push(boxMesh);

    // Create the Cannon-es physics body for the box with enhanced mass
    const halfExtents = new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2);
    const boxShape = new CANNON.Box(halfExtents);
    const boxBody = new CANNON.Body({ mass: 1 }); // increased mass for more dynamic interactions
    boxBody.addShape(boxShape);
    boxBody.position.copy(new CANNON.Vec3(
      boxMesh.position.x,
      boxMesh.position.y,
      boxMesh.position.z
    ));
    world.addBody(boxBody);

    // Store a reference from the physics body to the mesh for synchronization
    (boxBody as any).mesh = boxMesh;
    boxMesh.userData.boxBody = boxBody;
    // Assign the tone based on box size
    (boxBody as any).assignedTone = assignedTone;

    // Create synth based on chosen type and route through spatial nodes
    let boxSynth;
    if (chosenType === 'Synth') {
      boxSynth = new TONE.Synth({ oscillator: { type: "sine" } });
    } else if (chosenType === 'MetalSynth') {
      boxSynth = new TONE.MetalSynth();
    } else if (chosenType === 'PluckSynth') {
      boxSynth = new TONE.PluckSynth();
    } else if (chosenType === 'FMSynth') {
      boxSynth = new TONE.FMSynth();
    } else if (chosenType === 'AMSynth') {
      boxSynth = new TONE.AMSynth();
    }
    // Create a lowpass filter to emphasize bass frequencies
    const bassFilter = new TONE.Filter(400, "lowpass");
    // Create spatial processing nodes:
    const spatialPanner = new TONE.Panner(0); // horizontal panning (range -1 to 1)
    const spatialVolume = new TONE.Volume(-12); // base volume reduction (-12 dB)
    // Chain the synth output through the bass filter, then panner, then volume to destination
    boxSynth.chain(bassFilter, spatialPanner, spatialVolume, TONE.Destination);
    // Store references so we can update them on collision:
    (boxBody as any).assignedSynth = boxSynth;
    (boxBody as any).assignedPanner = spatialPanner;
    (boxBody as any).assignedVolume = spatialVolume;

    // Initialize a cooldown timestamp (reduced to 150ms for more snappy response)
    (boxBody as any).lastToneTime = 0;

    // Play the box's tone on collision only if the impact is significant
    boxBody.addEventListener('collide', (e: any) => {
      // Determine impact strength (drop out if too soft)
      const impactVelocity = e.contact && e.contact.getImpactVelocityAlongNormal
                             ? e.contact.getImpactVelocityAlongNormal()
                             : 0;
      const threshold = 2; // Only trigger effect if impact velocity is above threshold
      if (impactVelocity < threshold) return;
      
      // FLASH: Change the box color to white briefly  
      const mesh = (boxBody as any).mesh;
      const originalColor = mesh.userData.originalColor; // stored during creation
      mesh.material.color.set(0xffffff);
      setTimeout(() => {
        mesh.material.color.setHex(originalColor);
      }, 150);
      
      // Compute distance and relative position of the box to the camera
      const boxPos = mesh.position;
      const camPos = camera.position;
      const diff = new THREE.Vector3().subVectors(boxPos, camPos);
      const distance = diff.length();
      const maxDistance = 50; // sound drop off range
      const volumeFactor = Math.max(0, 1 - distance / maxDistance);
      
      // Compute base volume from distance then add impact factor:
      let computedVolume = -12 - ((1 - volumeFactor) * 20);
      // Increase volume (i.e. reduce attenuation) proportional to impact velocity
      computedVolume = Math.min(computedVolume + impactVelocity * 2, 0);
      
      // Determine panning relative to camera's right vector.
      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
      const panValue = diff.dot(cameraRight) / distance;
      
      // Update spatial nodes for this box's synth:
      const assignedPanner = (boxBody as any).assignedPanner;
      const assignedVolume = (boxBody as any).assignedVolume;
      assignedPanner.pan.value = panValue;
      assignedVolume.volume.value = computedVolume;
      
      // Prevent spam triggering and play sound (if cooldown elapsed)
      const now = performance.now();
      if (now - (boxBody as any).lastToneTime > 150) {
        (boxBody as any).lastToneTime = now;
        (boxBody as any).assignedSynth.triggerAttackRelease((boxBody as any).assignedTone, "8n");
      }
    });
  }
  
  function spawnBlock() {
    // Create a new block similar to the ones in the original loop
    const boxSize = Math.random() * (3.0 - 0.3) + 0.3; // size between 0.3 and 3.0
    
    // Calculate tone based on box size
    const sizeMin = 0.3, sizeMax = 3.0;
    const normalized = (boxSize - sizeMin) / (sizeMax - sizeMin);
    const inverted = 1 - normalized;
    const toneIndex = Math.floor(inverted * (tones.length - 1));
    const assignedTone = tones[toneIndex];
    
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    
    // Choose a synth type and assign corresponding color
    const chosenType = synthTypes[Math.floor(Math.random() * synthTypes.length)];
    const boxMat = new THREE.MeshStandardMaterial({ color: synthColorMap[chosenType] });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.userData.originalColor = synthColorMap[chosenType];
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    // Add black outline
    const edges = new THREE.EdgesGeometry(boxGeo);
    const outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 10 })
    );
    boxMesh.add(outline);
    
    // Position at a random x/z and high above so it drops down
    boxMesh.position.set((Math.random() - 0.5) * 40, 50, (Math.random() - 0.5) * 40);
    scene.add(boxMesh);
    boxMeshArray.push(boxMesh);

    // Create the Cannon-es physics body for the block.
    const halfExtents = new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2);
    const boxShape = new CANNON.Box(halfExtents);
    const boxBody = new CANNON.Body({ mass: 1 });
    boxBody.addShape(boxShape);
    boxBody.position.copy(new CANNON.Vec3(
      boxMesh.position.x,
      boxMesh.position.y,
      boxMesh.position.z
    ));
    world.addBody(boxBody);

    // Store a reference from the physics body to the mesh for synchronization
    (boxBody as any).mesh = boxMesh;
    boxMesh.userData.boxBody = boxBody;
    (boxBody as any).assignedTone = assignedTone;

    // Create synth based on chosen type and route through spatial nodes
    let boxSynth;
    if (chosenType === 'Synth') {
      boxSynth = new TONE.Synth({ oscillator: { type: "sine" } });
    } else if (chosenType === 'MetalSynth') {
      boxSynth = new TONE.MetalSynth();
    } else if (chosenType === 'PluckSynth') {
      boxSynth = new TONE.PluckSynth();
    } else if (chosenType === 'FMSynth') {
      boxSynth = new TONE.FMSynth();
    } else if (chosenType === 'AMSynth') {
      boxSynth = new TONE.AMSynth();
    }
    // Create a lowpass filter to emphasize bass frequencies
    const bassFilter = new TONE.Filter(400, "lowpass");
    const spatialPanner = new TONE.Panner(0);
    const spatialVolume = new TONE.Volume(-12);
    boxSynth.chain(bassFilter, spatialPanner, spatialVolume, TONE.Destination);
    (boxBody as any).assignedSynth = boxSynth;
    (boxBody as any).assignedPanner = spatialPanner;
    (boxBody as any).assignedVolume = spatialVolume;
    (boxBody as any).lastToneTime = 0;

    // Attach the collision listener (same as before)
    boxBody.addEventListener('collide', (e: any) => {
      const impactVelocity = e.contact && e.contact.getImpactVelocityAlongNormal
        ? e.contact.getImpactVelocityAlongNormal()
        : 0;
      const threshold = 2;
      if (impactVelocity < threshold) return;

      const mesh = (boxBody as any).mesh;
      const originalColor = mesh.userData.originalColor;
      mesh.material.color.set(0xffffff);
      setTimeout(() => {
        mesh.material.color.setHex(originalColor);
      }, 150);

      const boxPos = mesh.position;
      const camPos = camera.position;
      const diff = new THREE.Vector3().subVectors(boxPos, camPos);
      const distance = diff.length();
      const maxDistance = 50;
      const volumeFactor = Math.max(0, 1 - distance / maxDistance);
      let computedVolume = -12 - ((1 - volumeFactor) * 20);
      computedVolume = Math.min(computedVolume + impactVelocity * 2, 0);
      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
      const panValue = diff.dot(cameraRight) / distance;
      (boxBody as any).assignedPanner.pan.value = panValue;
      (boxBody as any).assignedVolume.volume.value = computedVolume;

      const now = performance.now();
      if (now - (boxBody as any).lastToneTime > 150) {
        (boxBody as any).lastToneTime = now;
        (boxBody as any).assignedSynth.triggerAttackRelease((boxBody as any).assignedTone, "8n");
      }
    });
    
    // Update our block counter element
    updateBlockCounter();
  }
  
  setInterval(spawnBlock, 2000);
  
  // Movement variables
  const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = true;
    }
    // Check for spacebar jump (using a downward raycast to allow jumps off any surface)
    if (event.code === 'Space') {
      const playerRadius = 1; // using same value as the sphere shape for the player
      const downRaycaster = new THREE.Raycaster();
      const origin = playerBody.position.clone();
      // Set ray downward (0, -1, 0)
      downRaycaster.set(origin, new THREE.Vector3(0, -1, 0));

      // Include the ground mesh and all block meshes in the raycast
      const intersectObjects = [groundMesh, ...boxMeshArray];
      const intersects = downRaycaster.intersectObjects(intersectObjects);
      
      // Use a threshold of (playerRadius + small epsilon) for grounding
      if (intersects.length > 0 && intersects[0].distance <= playerRadius + 0.2) {
        // Trigger the jump with increased power (sound removed)
        playerBody.velocity.y = 18;

        // If jumping off a block (non-ground), apply a stronger reaction impulse to it
        if (intersects[0].object.userData.boxBody) {
          const blockBody = intersects[0].object.userData.boxBody;
          // Apply a downward impulse to simulate the push-off effect (adjust impulse magnitude as needed)
          blockBody.applyImpulse(new CANNON.Vec3(0, -7, 0), blockBody.position);
        }
      }
    }
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = false;
    }
  });
  
  // Melee hit on mousedown when pointer is locked
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (!controls.isLocked) return;

    const meleeRange = 5;
    // Create a raycaster from the camera's position and its forward direction
    const forwardDir = camera.getWorldDirection(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(camera.position, forwardDir, 0, meleeRange);
    const intersects = raycaster.intersectObjects(boxMeshArray);

    if (intersects.length > 0) {
      // Object is in striking distance: execute hit logic
      const hit = intersects[0];
      const hitBoxBody = hit.object.userData.boxBody;
      if (hitBoxBody) {
        // Apply a stronger impulse in the forward direction for a snappier block response
        const forceDir = new CANNON.Vec3(forwardDir.x, forwardDir.y, forwardDir.z);
        forceDir.scale(6, forceDir);
        hitBoxBody.applyImpulse(forceDir, hitBoxBody.position);

        // Flash effect: turn the block white briefly
        const mesh = hit.object;
        const originalColor = mesh.userData.originalColor;
        mesh.material.color.set(0xffffff);
        setTimeout(() => {
          mesh.material.color.setHex(originalColor);
        }, 150);

        // Play snare sound for a successful hit
        snareSynth.triggerAttackRelease("C4", "8n");
      }
    } else {
      // No object in range: play rimshot sound as feedback for an empty swing
      rimshotSynth.triggerAttackRelease("F#4", "8n");
    }
  });
  
  // Create crosshair element
  const crosshairElem = document.createElement('div');
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
  
  // Add Stats.js for performance monitoring
  const stats = Stats();
  document.body.appendChild(stats.dom);
  
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
    world.step(1/60, dt, 3);
    requestAnimationFrame(animate);
    
    // Update camera position to match the player's physics body
    if (controls.isLocked) {
      camera.position.copy(playerBody.position as unknown as THREE.Vector3);
    }
    
    // Basic WASD movement: calculate front and side speeds
    const speed = 40; // increased movement speed for faster responsiveness
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // ignore vertical component
    forward.normalize();
    right.crossVectors(camera.up, forward).normalize();

    let moveX = 0;
    let moveZ = 0;
    if (keys.w) moveZ += 1;  // W now moves forward
    if (keys.s) moveZ -= 1;  // S now moves backward
    if (keys.a) moveX += 1;  // A now strafes left (relative to camera)
    if (keys.d) moveX -= 1;  // D now strafes right

    const velocity = new CANNON.Vec3();
    if (moveZ !== 0 || moveX !== 0) {
      const moveDir = new THREE.Vector3();
      moveDir.add(forward.multiplyScalar(moveZ)).add(right.multiplyScalar(moveX));
      moveDir.normalize().multiplyScalar(speed);
      velocity.x = moveDir.x;
      velocity.z = moveDir.z;
    }
    // Preserve Y-velocity (gravity/jump)
    playerBody.velocity.x = velocity.x;
    playerBody.velocity.z = velocity.z;
    
    // Update boxes' Three.js meshes from their Cannon bodies
    world.bodies.forEach(body => {
      if ((body as any).mesh) {
        const mesh = (body as any).mesh as THREE.Mesh;
        mesh.position.copy(body.position as unknown as THREE.Vector3);
        mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
      }
    });
    
    // Crosshair update based on a forward raycast
    const meleeRange = 5;
    const forwardDir = camera.getWorldDirection(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(camera.position, forwardDir, 0, meleeRange);
    const intersects = raycaster.intersectObjects(boxMeshArray);
    if (intersects.length > 0) {
      crosshairElem.style.borderColor = "red";
    } else {
      crosshairElem.style.borderColor = "white";
    }
    
    renderer.render(scene, camera);
  }
  
  animate();
  
  // Remove loading text once the game is loaded
  const loadingElem = document.getElementById('loading');
  if (loadingElem) {
    loadingElem.remove();
  }
  
  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Start the game
init().catch(console.error);
