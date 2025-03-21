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
  
  const synth = new TONE.PolySynth(TONE.Synth).toDestination();
  
  // Setup physics
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -20, 0)
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
  
  // Create many boxes scattered about for a more dynamic environment
  const boxCount = 200; // reduced number of boxes as per new requirements
  for (let i = 0; i < boxCount; i++) {
    // Create the Three.js mesh for the box
    const boxSize = Math.random() * (2.0 - 0.5) + 0.5; // size between 0.5 and 2.0
    
    // Calculate tone based on box size
    const sizeMin = 0.5, sizeMax = 2.0;
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
    // Create spatial processing nodes:
    const spatialPanner = new TONE.Panner(0); // horizontal panning (range -1 to 1)
    const spatialVolume = new TONE.Volume(-12); // base volume reduction (-12 dB)
    // Chain the synth output through the panner then volume, then to destination
    boxSynth.chain(spatialPanner, spatialVolume, TONE.Destination);
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
  
  // Movement variables
  const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = true;
    }
    // Check for spacebar jump (use " " or "spacebar")
    if (event.code === 'Space') {
      if (playerBody.position.y <= 1.1) {  // simple ground check
        playerBody.velocity.y = 6; // jump impulse (adjust as desired)
        synth.triggerAttackRelease("C4", "8n");
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
    
    // Set up a raycaster from the camera in its forward direction.
    const raycaster = new THREE.Raycaster();
    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(origin, direction);
    
    // Find intersections with our stored box meshes
    const intersections = raycaster.intersectObjects(boxMeshArray);
    if (intersections.length > 0) {
      const hit = intersections[0];
      // Only register a hit if the box is within a small threshold distance (e.g., 5 units)
      if (hit.distance < 5) {
        // Retrieve the corresponding physics body from hit mesh
        const hitBoxBody = hit.object.userData.boxBody;
        if (hitBoxBody) {
          // Apply a weaker impulse force in the forward direction (multiplier 3 instead of 5)
          const forceDirection = new CANNON.Vec3(direction.x, direction.y, direction.z);
          forceDirection.scale(3, forceDirection);
          hitBoxBody.applyImpulse(forceDirection, hitBoxBody.position);
          
          // Manually trigger the flash and sound effect for the hit box
          const impactVelocity = 3; // a constant assumed for melee hit impact
          // FLASH: make the block flash white
          const mesh = hit.object;
          const originalColor = mesh.userData.originalColor;
          mesh.material.color.set(0xffffff);
          setTimeout(() => {
            mesh.material.color.setHex(originalColor);
          }, 150);
          
          // Compute spatial audio parameters similar to collision event:
          const diff = new THREE.Vector3().subVectors(mesh.position, camera.position);
          const distance = diff.length();
          const maxDistance = 50;
          const volumeFactor = Math.max(0, 1 - distance / maxDistance);
          let computedVolume = -12 - ((1 - volumeFactor) * 20);
          computedVolume = Math.min(computedVolume + impactVelocity * 2, 0);
          const cameraRight = new THREE.Vector3();
          cameraRight.crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
          const panValue = diff.dot(cameraRight) / distance;
          hitBoxBody.assignedPanner.pan.value = panValue;
          hitBoxBody.assignedVolume.volume.value = computedVolume;
          
          // Trigger the box's synth for the melee hit
          hitBoxBody.assignedSynth.triggerAttackRelease(hitBoxBody.assignedTone, "8n");
        }
      }
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
