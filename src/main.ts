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
  
  // Define an array of possible tones to assign
  const tones = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

  // Create several boxes scattered about
  const boxCount = 5; // adjust the number as needed
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

    // Create the Cannon-es physics body for the box
    const halfExtents = new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2);
    const boxShape = new CANNON.Box(halfExtents);
    const boxBody = new CANNON.Body({ mass: 0.5 });  // give it some mass so it can react slightly
    boxBody.addShape(boxShape);
    boxBody.position.copy(new CANNON.Vec3(
      boxMesh.position.x,
      boxMesh.position.y,
      boxMesh.position.z
    ));
    world.addBody(boxBody);

    // Store a reference from the physics body to the mesh for synchronization
    // and assign a random tone for this box
    (boxBody as any).mesh = boxMesh;
    (boxBody as any).assignedTone = tones[Math.floor(Math.random() * tones.length)];
    // Initialize a simple cooldown timestamp to avoid spam triggering
    (boxBody as any).lastToneTime = 0;

    // When the box is hit by the player, play its tone.
    // (Assuming the player's physics body is "playerBody")
    boxBody.addEventListener('collide', (e: any) => {
      // e.body is the other body in collision.
      if (e.body === playerBody) { 
        const now = performance.now();
        if (now - (boxBody as any).lastToneTime > 300) { // 300ms cooldown
          (boxBody as any).lastToneTime = now;
          // Trigger the assigned tone using Tone.js synth
          synth.triggerAttackRelease((boxBody as any).assignedTone, "8n");
        }
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
  
  // Jump on click/tap if near ground
  renderer.domElement.addEventListener('click', () => {
    if (playerBody.position.y <= 1.1) {
      playerBody.velocity.y = 5; // adjust jump speed as needed
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
    const speed = 5;
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
