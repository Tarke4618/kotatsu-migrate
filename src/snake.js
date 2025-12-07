// src/snake.js - Interactive Snake that follows mouse/touch with bending body

(function() {
  // Create canvas for snake
  const snakeCanvas = document.createElement('canvas');
  snakeCanvas.id = 'snake-canvas';
  snakeCanvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
  `;
  document.body.appendChild(snakeCanvas);

  const ctx = snakeCanvas.getContext('2d');
  
  // Set canvas size
  function resizeCanvas() {
    snakeCanvas.width = window.innerWidth;
    snakeCanvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Snake segments
  const segmentCount = 50;
  const segments = [];
  const segmentLength = 12;
  
  // Initialize segments at center
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }

  // Mouse position
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  // Track mouse
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

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

  // Animation
  function animate() {
    ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    // Set global alpha for 60% opacity
    ctx.globalAlpha = 0.6;

    // Head follows mouse with easing
    const head = segments[0];
    const dx = mouseX - head.x;
    const dy = mouseY - head.y;
    head.x += dx * 0.15;
    head.y += dy * 0.15;

    // Each segment follows the one before it
    for (let i = 1; i < segmentCount; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];
      
      const segDx = prev.x - curr.x;
      const segDy = prev.y - curr.y;
      const dist = Math.sqrt(segDx * segDx + segDy * segDy);
      
      if (dist > segmentLength) {
        const angle = Math.atan2(segDy, segDx);
        curr.x = prev.x - Math.cos(angle) * segmentLength;
        curr.y = prev.y - Math.sin(angle) * segmentLength;
      }
    }

    // Draw snake body
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Main body gradient - yellow to orange
    for (let i = segmentCount - 1; i >= 0; i--) {
      const segment = segments[i];
      const progress = i / segmentCount;
      
      // Body width tapers from head to tail
      const baseWidth = 25;
      const width = baseWidth * (1 - progress * 0.7);
      
      // Color gradient: bright yellow at head, darker at tail
      const brightness = 255 - progress * 80;
      const green = Math.floor(200 - progress * 100);
      
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, width, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${brightness}, ${green}, 0)`;
      ctx.fill();
    }
    
    // Draw scales pattern
    ctx.globalAlpha = 0.4;
    for (let i = 2; i < segmentCount - 3; i += 3) {
      const segment = segments[i];
      const progress = i / segmentCount;
      const width = 25 * (1 - progress * 0.7);
      
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, width * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 165, 0, ${0.5 - progress * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw head details
    ctx.globalAlpha = 0.8;
    const headSegment = segments[0];
    const nextSegment = segments[1];
    const headAngle = Math.atan2(
      headSegment.y - nextSegment.y,
      headSegment.x - nextSegment.x
    );

    // Eyes
    const eyeOffset = 8;
    const eyeSize = 6;
    
    const leftEyeX = headSegment.x + Math.cos(headAngle + 0.5) * eyeOffset;
    const leftEyeY = headSegment.y + Math.sin(headAngle + 0.5) * eyeOffset;
    const rightEyeX = headSegment.x + Math.cos(headAngle - 0.5) * eyeOffset;
    const rightEyeY = headSegment.y + Math.sin(headAngle - 0.5) * eyeOffset;

    // Eye whites
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
    ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Pupils
    const pupilOffset = 2;
    ctx.beginPath();
    ctx.arc(leftEyeX + Math.cos(headAngle) * pupilOffset, leftEyeY + Math.sin(headAngle) * pupilOffset, 3, 0, Math.PI * 2);
    ctx.arc(rightEyeX + Math.cos(headAngle) * pupilOffset, rightEyeY + Math.sin(headAngle) * pupilOffset, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Tongue
    const tongueTime = Date.now() * 0.005;
    const tongueFlick = Math.sin(tongueTime) > 0.7;
    
    if (tongueFlick) {
      const tongueLength = 30;
      const tongueStartX = headSegment.x + Math.cos(headAngle) * 20;
      const tongueStartY = headSegment.y + Math.sin(headAngle) * 20;
      
      ctx.beginPath();
      ctx.moveTo(tongueStartX, tongueStartY);
      
      const tongueEndX = tongueStartX + Math.cos(headAngle) * tongueLength;
      const tongueEndY = tongueStartY + Math.sin(headAngle) * tongueLength;
      
      // Forked tongue
      ctx.lineTo(tongueEndX, tongueEndY);
      ctx.moveTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle + 0.3) * 10, tongueEndY + Math.sin(headAngle + 0.3) * 10);
      ctx.moveTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle - 0.3) * 10, tongueEndY + Math.sin(headAngle - 0.3) * 10);
      
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Glow around head
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(headSegment.x, headSegment.y, 35, 0, Math.PI * 2);
    const headGlow = ctx.createRadialGradient(
      headSegment.x, headSegment.y, 0,
      headSegment.x, headSegment.y, 50
    );
    headGlow.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    headGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = headGlow;
    ctx.fill();

    // Reset alpha
    ctx.globalAlpha = 1;

    requestAnimationFrame(animate);
  }

  animate();
})();
