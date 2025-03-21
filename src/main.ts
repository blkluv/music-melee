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
  
  // Add a simple test cube
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  
  // Attach 3D audio to the cube for environmental sound
  const positionalAudio = new THREE.PositionalAudio(audioListener);
  const audioLoader = new THREE.AudioLoader();
  audioLoader.load('path/to/your/sample.mp3', (buffer) => {
    positionalAudio.setBuffer(buffer);
    positionalAudio.setRefDistance(20);
    positionalAudio.setLoop(true);
    positionalAudio.play();
  });
  cube.add(positionalAudio);
  
  camera.position.z = 5;
  
  // Setup Tone.js
  await TONE.start();
  console.log('Audio context started');
  
  const synth = new TONE.Synth().toDestination();
  
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
    
    // Rotate cube
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    
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
    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

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
    
    renderer.render(scene, camera);
  }
  
  animate();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Start the game
init().catch(console.error);
