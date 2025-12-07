// src/three-bg.js - Three.js Particle Background with Mouse Interaction

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

  // Particle system - Light ash color
  const particleCount = 800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const originalPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const x = (Math.random() - 0.5) * 60;
    const y = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 30 - 10;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    originalPositions[i * 3] = x;
    originalPositions[i * 3 + 1] = y;
    originalPositions[i * 3 + 2] = z;
    
    velocities[i * 3] = 0;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Light ash color material
  const material = new THREE.PointsMaterial({
    size: 0.08,
    color: 0xC0C0C0, // Light ash/silver color
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  camera.position.z = 25;

  // Mouse tracking
  document.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 30;
    targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 30;
  });

  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      targetMouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 30;
      targetMouseY = -(e.touches[0].clientY / window.innerHeight - 0.5) * 30;
    }
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Smooth mouse follow
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Update particle positions based on mouse
    const positions = geometry.attributes.position.array;
    const time = Date.now() * 0.0005;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Get original position
      const ox = originalPositions[i3];
      const oy = originalPositions[i3 + 1];
      const oz = originalPositions[i3 + 2];
      
      // Calculate distance from mouse in 3D
      const dx = ox - mouseX;
      const dy = oy - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Particles are pushed away by mouse, with falloff
      const influence = Math.max(0, 1 - dist / 15) * 3;
      
      // Add some floating motion
      const floatX = Math.sin(time + i * 0.1) * 0.5;
      const floatY = Math.cos(time + i * 0.15) * 0.5;
      
      // Apply displacement
      positions[i3] = ox + (dx / dist) * influence + floatX;
      positions[i3 + 1] = oy + (dy / dist) * influence + floatY;
      positions[i3 + 2] = oz + Math.sin(time + i * 0.05) * 0.3;
      
      // Handle NaN from division by zero
      if (isNaN(positions[i3])) positions[i3] = ox;
      if (isNaN(positions[i3 + 1])) positions[i3 + 1] = oy;
    }
    
    geometry.attributes.position.needsUpdate = true;

    // Slow particle system rotation
    particles.rotation.z += 0.0002;

    renderer.render(scene, camera);
  }

  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
