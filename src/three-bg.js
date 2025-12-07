// src/three-bg.js - Three.js Futuristic Particle Background

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

  // Particle system
  const particleCount = 500;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  // Golden color palette
  const goldColors = [
    { r: 1.0, g: 0.84, b: 0.0 },   // Gold
    { r: 1.0, g: 0.65, b: 0.0 },   // Orange gold
    { r: 1.0, g: 0.94, b: 0.0 },   // Bright yellow
    { r: 0.85, g: 0.65, b: 0.13 }, // Goldenrod
  ];

  for (let i = 0; i < particleCount; i++) {
    // Spread particles in 3D space
    positions[i * 3] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 15;

    // Random gold color
    const color = goldColors[Math.floor(Math.random() * goldColors.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = Math.random() * 3 + 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Custom shader material for glowing particles
  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Add floating geometric shapes
  const shapes = [];
  const shapeMaterial = new THREE.MeshBasicMaterial({
    color: 0xFFD700,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  // Create random geometric shapes
  const geometries = [
    new THREE.TetrahedronGeometry(0.5),
    new THREE.OctahedronGeometry(0.4),
    new THREE.IcosahedronGeometry(0.3),
  ];

  for (let i = 0; i < 15; i++) {
    const geo = geometries[Math.floor(Math.random() * geometries.length)];
    const mesh = new THREE.Mesh(geo, shapeMaterial.clone());
    mesh.position.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 20 - 10
    );
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    mesh.userData = {
      rotSpeed: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02,
      },
      floatSpeed: Math.random() * 0.5 + 0.5,
      floatOffset: Math.random() * Math.PI * 2,
    };
    shapes.push(mesh);
    scene.add(mesh);
  }

  // Add connecting lines between nearby particles
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xFFD700,
    transparent: true,
    opacity: 0.1,
  });

  camera.position.z = 20;

  // Mouse parallax
  let mouseX = 0;
  let mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Rotate particle system
    particles.rotation.y += 0.0005;
    particles.rotation.x += 0.0002;

    // Update particle positions (floating effect)
    const positions = geometry.attributes.position.array;
    const time = Date.now() * 0.001;
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 1] += Math.sin(time + i * 0.1) * 0.002;
    }
    geometry.attributes.position.needsUpdate = true;

    // Animate shapes
    shapes.forEach((shape, i) => {
      shape.rotation.x += shape.userData.rotSpeed.x;
      shape.rotation.y += shape.userData.rotSpeed.y;
      shape.rotation.z += shape.userData.rotSpeed.z;
      shape.position.y += Math.sin(time * shape.userData.floatSpeed + shape.userData.floatOffset) * 0.005;
    });

    // Camera follows mouse slightly
    camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 2 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

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
