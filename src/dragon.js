// src/dragon.js - Interactive Dragon that follows mouse/touch

(function() {
  const dragon = document.getElementById('dragon');
  if (!dragon) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let dragonX = mouseX;
  let dragonY = mouseY;
  let targetRotation = 0;
  let currentRotation = 0;
  let isFlipped = false;

  // Dragon size
  const dragonSize = 120;
  dragon.style.width = dragonSize + 'px';
  dragon.style.height = dragonSize + 'px';

  // Smooth follow animation
  function animate() {
    // Easing factor - lower = smoother
    const ease = 0.08;
    
    // Calculate distance to mouse
    const dx = mouseX - dragonX;
    const dy = mouseY - dragonY;
    
    // Move towards mouse with easing
    dragonX += dx * ease;
    dragonY += dy * ease;
    
    // Determine if dragon should flip (facing direction)
    const shouldFlip = dx < 0;
    if (shouldFlip !== isFlipped) {
      isFlipped = shouldFlip;
    }
    
    // Calculate rotation based on movement direction
    targetRotation = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI) * 0.3;
    currentRotation += (targetRotation - currentRotation) * 0.1;
    
    // Apply transforms
    const scaleX = isFlipped ? -1 : 1;
    dragon.style.transform = `translate(${dragonX - dragonSize/2}px, ${dragonY - dragonSize/2}px) scaleX(${scaleX}) rotate(${currentRotation}deg)`;
    
    // Wing flap animation based on speed
    const speed = Math.sqrt(dx * dx + dy * dy);
    const wingFlap = Math.sin(Date.now() * 0.02) * (speed > 5 ? 1 : 0.3);
    dragon.style.filter = `drop-shadow(0 0 ${10 + wingFlap * 5}px #FFD700) drop-shadow(0 0 ${20 + wingFlap * 10}px #FFA500)`;
    
    requestAnimationFrame(animate);
  }

  // Mouse tracking
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Touch tracking
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
    }
  });

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
    }
  });

  // Start animation
  animate();

  // Fire breath animation
  const fireParticles = dragon.querySelectorAll('.fire');
  function animateFire() {
    fireParticles.forEach((particle, i) => {
      const offset = Math.sin(Date.now() * 0.01 + i) * 3;
      particle.setAttribute('cy', 42 + offset);
      particle.setAttribute('opacity', 0.4 + Math.sin(Date.now() * 0.02 + i) * 0.4);
    });
    requestAnimationFrame(animateFire);
  }
  animateFire();
})();
