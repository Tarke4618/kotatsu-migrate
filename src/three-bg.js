// src/three-bg.js - Three.js Particle Background with Mouse Interaction
// cspell:words raycaster Raycaster lerp
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

  // Mouse position in 3D space
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  // Particle system
  const particleCount = 1000; 
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const originalPositions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
 
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

    // Dual color split: Orange/Red for Kotatsu and Green/Teal for Mihon
    const isKotatsu = Math.random() > 0.5;
    if (isKotatsu) {
      colors[i * 3] = 1.0;                     // R
      colors[i * 3 + 1] = 0.3 + Math.random() * 0.25; // G
      colors[i * 3 + 2] = 0.0;                 // B
    } else {
      colors[i * 3] = 0.0;                     // R
      colors[i * 3 + 1] = 0.85 + Math.random() * 0.15; // G
      colors[i * 3 + 2] = 0.4 + Math.random() * 0.4;  // B
    }
  }
 
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
 
  // Material
  const material = new THREE.PointsMaterial({
    size: 0.45,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
 
  const particles = new THREE.Points(geometry, material);
  scene.add(particles);
 
  camera.position.z = 30;

  // Event Listeners
  document.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 40;
    targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 40;
  });

  document.addEventListener('mouseleave', () => {
    targetMouseX = 0;
    targetMouseY = 0;
  });

  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      targetMouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 40;
      targetMouseY = -(e.touches[0].clientY / window.innerHeight - 0.5) * 40;
    }
  });

  document.addEventListener('touchend', () => {
    targetMouseX = 0;
    targetMouseY = 0;
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    try {
      const positionsArr = geometry.attributes.position.array;
      const time = Date.now() * 0.0003;

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
      
      geometry.attributes.position.needsUpdate = true;
      particles.rotation.z += 0.001; // Slightly faster rotation

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
