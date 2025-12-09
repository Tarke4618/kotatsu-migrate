// src/three-bg.js - Three.js Particle Background with Mouse Interaction
// Only ash-colored particles, no geometric shapes

(function() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || !window.THREE) return;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  // Constants
  const STATES = {
    IDLE: 'IDLE',
    GATHERING: 'GATHERING',
    BURSTING: 'BURSTING'
  };

  // State
  let currentState = STATES.IDLE;
  let gatherTarget = new THREE.Vector3();
  let gatherStartTime = 0;

  // Mouse position in 3D space (for IDLE state)
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  // Particle system
  // Reduced to 1000 for performance stability while keeping density
  const particleCount = 1000; 
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const originalPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3); // For burst physics
  const sphereOffsets = new Float32Array(particleCount * 3); // For sphere shape targets

  // Initialize particles
  for (let i = 0; i < particleCount; i++) {
    const x = (Math.random() - 0.5) * 80;
    const y = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 40 - 15;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    originalPositions[i * 3] = x;
    originalPositions[i * 3 + 1] = y;
    originalPositions[i * 3 + 2] = z;

    // Pre-calculate sphere shape offsets (radius 2)
    const phi = Math.acos(-1 + (2 * i) / particleCount);
    const theta = Math.sqrt(particleCount * Math.PI) * phi;
    
    sphereOffsets[i * 3] = 2 * Math.cos(theta) * Math.sin(phi);
    sphereOffsets[i * 3 + 1] = 2 * Math.sin(theta) * Math.sin(phi);
    sphereOffsets[i * 3 + 2] = 2 * Math.cos(phi);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Material
  const material = new THREE.PointsMaterial({
    size: 0.35, // Slightly larger since we have fewer particles
    color: 0xD4AF37, // Metallic Gold
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  camera.position.z = 30;

  // Helpers
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function triggerExplosion(event) {
    if (currentState === STATES.GATHERING) return; // Prevent double trigger

    // Get click coordinates normalized
    let clientX, clientY;
    if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    // Raycast to find a point in 3D space
    raycaster.setFromCamera(mouse, camera);
    const vec = new THREE.Vector3();
    
    // Project ray to z=0 plane to ensure accurate positioning across the screen
    // t = -origin.z / direction.z
    // origin.z is usually 30 (camera pos)
    const targetZ = 0;
    const distanceToPlane = (targetZ - raycaster.ray.origin.z) / raycaster.ray.direction.z;
    vec.copy(raycaster.ray.direction).multiplyScalar(distanceToPlane).add(raycaster.ray.origin);

    gatherTarget.copy(vec);
    currentState = STATES.GATHERING;
    gatherStartTime = Date.now();
  }

  // Event Listeners
  window.addEventListener('click', triggerExplosion);
  window.addEventListener('touchstart', triggerExplosion, { passive: false });

  document.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 40;
    targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 40;
  });

  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      targetMouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 40;
      targetMouseY = -(e.touches[0].clientY / window.innerHeight - 0.5) * 40;
    }
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    try {
        const positionsArr = geometry.attributes.position.array;
        const time = Date.now() * 0.0003;

        if (currentState === STATES.IDLE) {
        // --- IDLE STATE ---
        // Smooth mouse follow
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const ox = originalPositions[i3];
            const oy = originalPositions[i3 + 1];
            const oz = originalPositions[i3 + 2];
            
            // Return slowly to original pos
            const dx = ox - mouseX;
            const dy = oy - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Repulsion logic
            const influence = Math.max(0, 1 - dist / 20) * 4;
            
            // Float
            const floatX = Math.sin(time + i * 0.1) * 0.3;
            const floatY = Math.cos(time + i * 0.15) * 0.3;
            
            // Current pos
            const cx = positionsArr[i3];
            const cy = positionsArr[i3 + 1];
            const cz = positionsArr[i3 + 2];

            // Lerp towards idle target
            let tx = ox + floatX;
            let ty = oy + floatY;
            let tz = oz + Math.sin(time + i * 0.05) * 0.2;

            if (dist > 0.1) {
                tx += (dx / dist) * influence;
                ty += (dy / dist) * influence;
            }

            positionsArr[i3] += (tx - cx) * 0.05;
            positionsArr[i3 + 1] += (ty - cy) * 0.05;
            positionsArr[i3 + 2] += (tz - cz) * 0.05;
        }

        } else if (currentState === STATES.GATHERING) {
        // --- GATHERING STATE ---
        // Move all particles to gatherTarget + sphereOffset
        
        let allArrived = true;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            const tx = gatherTarget.x + sphereOffsets[i3];
            const ty = gatherTarget.y + sphereOffsets[i3 + 1];
            const tz = gatherTarget.z + sphereOffsets[i3 + 2];

            // Super fast lerp for snapping effect
            positionsArr[i3] += (tx - positionsArr[i3]) * 0.2;
            positionsArr[i3 + 1] += (ty - positionsArr[i3 + 1]) * 0.2;
            positionsArr[i3 + 2] += (tz - positionsArr[i3 + 2]) * 0.2;

            // Check distance
            const dx = tx - positionsArr[i3];
            const dy = ty - positionsArr[i3 + 1];
            const dz = tz - positionsArr[i3 + 2];
            const distSq = dx*dx + dy*dy + dz*dz;

            if (distSq > 1.0) allArrived = false; // Slightly larger threshold
        }

        // If most arrived or timeout (0.8s max gather), trigger burst
        if (allArrived || (Date.now() - gatherStartTime > 800)) {
            currentState = STATES.BURSTING;
            
            // Initialize burst velocities
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                
                // Explode outwards from center of sphere
                // Use sphere offsets as direction vector since they are from center (0,0,0) relative to target
                // Normalizing just in case, though sphereOffsets are on radius 2
                
                // Direction is same as offset vector normalized
                const len = 2.0; // Radius
                const dx = sphereOffsets[i3] / len;
                const dy = sphereOffsets[i3+1] / len;
                const dz = sphereOffsets[i3+2] / len;
                        
                const speed = 0.8 + Math.random() * 2.0; // High explosive speed
                velocities[i3] = dx * speed;
                velocities[i3 + 1] = dy * speed;
                velocities[i3 + 2] = dz * speed;
            }
        }

        } else if (currentState === STATES.BURSTING) {
        // --- BURSTING STATE ---
        let totalSpeed = 0;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Apply velocity
            positionsArr[i3] += velocities[i3];
            positionsArr[i3 + 1] += velocities[i3 + 1];
            positionsArr[i3 + 2] += velocities[i3 + 2];

            // Drag
            velocities[i3] *= 0.90; // Strong drag
            velocities[i3 + 1] *= 0.90;
            velocities[i3 + 2] *= 0.90;

            totalSpeed += Math.abs(velocities[i3]) + Math.abs(velocities[i3+1]) + Math.abs(velocities[i3+2]);
        }

        // Output log for debugging loop sanity (throttled)
        // if (Math.random() < 0.01) console.log("Bursting speed", totalSpeed);

        // If slowed down enough, go back to IDLE
        if (totalSpeed < particleCount * 0.05) {
            currentState = STATES.IDLE;
        }
        }
        
        geometry.attributes.position.needsUpdate = true;

        if (currentState === STATES.IDLE) {
            particles.rotation.z += 0.001; // Sightly faster rotation
        }

        renderer.render(scene, camera);
    } catch (e) {
        console.error("Animation error:", e);
    }
  }

  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
