// Music Melee - Main Entry Point
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import * as TONE from 'tone';
import * as CANNON from 'cannon-es';

// Initialize the game
async function init() {
  console.log('Music Melee initializing...');
  
  // Setup Three.js scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // Add an AudioListener to the camera for 3D audio
  const audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  
  // Initialize PointerLockControls for first-person navigation
  const controls = new PointerLockControls(camera, renderer.domElement);
  // Optionally, trigger pointer lock on a user gesture (e.g., a click)
  renderer.domElement.addEventListener('click', () => {
    controls.lock();
  });
  
  // Increase camera look sensitivity by overriding the mousemove event
  const sensitivityMultiplier = 2.0; // adjust to taste

  // Remove the default mousemove listener added by PointerLockControls
  renderer.domElement.removeEventListener('mousemove', (controls as any).onMouseMove);

  // Add your own mousemove handler that applies a higher sensitivity
  renderer.domElement.addEventListener('mousemove', (event: MouseEvent) => {
    if (!controls.isLocked) return;
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Manually update camera rotation (this overrides the default handling)
    camera.rotation.y -= movementX * 0.002 * sensitivityMultiplier;
    camera.rotation.x -= movementY * 0.002 * sensitivityMultiplier;
    // Clamp the vertical rotation to avoid flipping
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  });
  
  
  camera.position.z = 5;
  
  // Create a visual ground plane
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  scene.add(groundMesh);
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(10, 10, 10);
  scene.add(dirLight);
  
  // Setup Tone.js
  await TONE.start();
  console.log('Audio context started');
  
  const synth = new TONE.PolySynth(TONE.Synth).toDestination();
  
  // Setup physics
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });
  
  // Create a simple player physics body (using a sphere shape)
  const playerShape = new CANNON.Sphere(1);
  const playerBody = new CANNON.Body({ mass: 1 });
  playerBody.addShape(playerShape);
  playerBody.position.set(0, 2, 0); // start a bit above ground
  world.addBody(playerBody);
  
  // Create a static ground plane for the player to stand on
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
  
  // Define an expanded array of possible tones (across multiple octaves)
  const tones = [
    "C3", "D3", "E3", "F3", "G3", "A3", "B3",
    "C4", "D4", "E4", "F4", "G4", "A4", "B4",
    "C5", "D5", "E5"
  ];

  // Create many boxes scattered about for a more dynamic environment
  const boxCount = 1000; // increased number of boxes for a denser environment
  for (let i = 0; i < boxCount; i++) {
    // Create the Three.js mesh for the box
    const boxSize = 1;
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    // Optionally assign a random color:
    const boxColor = Math.random() * 0xffffff;
    const boxMat = new THREE.MeshStandardMaterial({ color: boxColor });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    // Random placement: x and z between -20 and 20; y slightly above ground
    boxMesh.position.set((Math.random() - 0.5) * 40, boxSize / 2, (Math.random() - 0.5) * 40);
    scene.add(boxMesh);

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
    // Assign a random tone from the expanded list
    (boxBody as any).assignedTone = tones[Math.floor(Math.random() * tones.length)];

    // Assign a random synth type for variety (choose among Synth, MetalSynth, or PluckSynth)
    const synthTypes = ['Synth', 'MetalSynth', 'PluckSynth'];
    const chosenType = synthTypes[Math.floor(Math.random() * synthTypes.length)];
    let boxSynth;
    if (chosenType === 'Synth') {
      boxSynth = new TONE.Synth({ oscillator: { type: "sine" } }).toDestination();
    } else if (chosenType === 'MetalSynth') {
      boxSynth = new TONE.MetalSynth().toDestination();
    } else if (chosenType === 'PluckSynth') {
      boxSynth = new TONE.PluckSynth().toDestination();
    }
    (boxBody as any).assignedSynth = boxSynth;

    // Initialize a cooldown timestamp (reduced to 150ms for more snappy response)
    (boxBody as any).lastToneTime = 0;

    // Play the box's tone on collision only if the impact is significant
    boxBody.addEventListener('collide', (e: any) => {
      // e.contact is present for collision events in cannon-es.
      const impactVelocity = e.contact && e.contact.getImpactVelocityAlongNormal 
                               ? e.contact.getImpactVelocityAlongNormal() 
                               : 0;
      const threshold = 2; // Only trigger tone if impact velocity is above threshold
      if (impactVelocity < threshold) return;
      
      const now = performance.now();
      if (now - (boxBody as any).lastToneTime > 150) { // 150ms cooldown to prevent continuous triggering
        (boxBody as any).lastToneTime = now;
        (boxBody as any).assignedSynth.triggerAttackRelease((boxBody as any).assignedTone, "8n");
      }
    });
  }
  
  // Movement variables
  const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = false;
    }
  });
  
  // Jump on click/tap if near ground (snappier jump)
  renderer.domElement.addEventListener('click', () => {
    if (playerBody.position.y <= 1.1) {
      playerBody.velocity.y = 6; // lower jump for a more grounded feel
      synth.triggerAttackRelease("C4", "8n");
    }
  });

  // Animation loop
  function animate() {
    // Step the physics world (adjust timeStep as needed)
    world.step(1/60);
    requestAnimationFrame(animate);
    
    // Update camera position to match the player's physics body
    if (controls.isLocked) {
      camera.position.copy(playerBody.position as unknown as THREE.Vector3);
    }
    
    // Basic WASD movement: calculate front and side speeds
    const speed = 15; // increased speed for more DOOM-like responsiveness
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
