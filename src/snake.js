// src/snake.js - Interactive Snake with controlled speed

(function() {
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
  
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }

  // Mouse/touch position
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  // Track mouse
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Track touch - only update on actual touch events
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      e.preventDefault(); // Prevent scrolling
    }
  }, { passive: false });

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
    }
  });

  // Physics - CONTROLLED SPEED
  const OFFSET = 3;
  const SPEED = 0.08; // Slower, controlled speed
  const MAX_SPEED = 15; // Maximum pixels per frame

  function animate() {
    ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    // Head follows cursor with controlled speed
    const head = segments[0];
    let dx = mouseX - head.x;
    let dy = mouseY - head.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Apply offset (3px behind)
    if (dist > OFFSET) {
      dx = dx - (dx / dist) * OFFSET;
      dy = dy - (dy / dist) * OFFSET;
    }
    
    // Limit maximum speed
    let moveX = dx * SPEED;
    let moveY = dy * SPEED;
    const moveSpeed = Math.sqrt(moveX * moveX + moveY * moveY);
    
    if (moveSpeed > MAX_SPEED) {
      moveX = (moveX / moveSpeed) * MAX_SPEED;
      moveY = (moveY / moveSpeed) * MAX_SPEED;
    }
    
    head.x += moveX;
    head.y += moveY;

    // Segments follow each other
    for (let i = 1; i < segmentCount; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];
      
      const segDx = prev.x - curr.x;
      const segDy = prev.y - curr.y;
      const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
      
      if (segDist > segmentLength) {
        const angle = Math.atan2(segDy, segDx);
        curr.x = prev.x - Math.cos(angle) * segmentLength;
        curr.y = prev.y - Math.sin(angle) * segmentLength;
      }
    }

    // Draw snake body
    ctx.globalAlpha = 0.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (let i = segmentCount - 1; i >= 0; i--) {
      const segment = segments[i];
      const progress = i / segmentCount;
      
      const baseWidth = 22;
      const width = baseWidth * (1 - progress * 0.7);
      
      const brightness = 255 - progress * 80;
      const green = Math.floor(200 - progress * 100);
      
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, width, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${brightness}, ${green}, 0)`;
      ctx.fill();
    }
    
    // Scales
    ctx.globalAlpha = 0.3;
    for (let i = 2; i < segmentCount - 3; i += 3) {
      const segment = segments[i];
      const progress = i / segmentCount;
      const width = 22 * (1 - progress * 0.7);
      
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, width * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 165, 0, ${0.4 - progress * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Head details
    ctx.globalAlpha = 0.9;
    const headSegment = segments[0];
    const nextSegment = segments[1];
    const headAngle = Math.atan2(
      headSegment.y - nextSegment.y,
      headSegment.x - nextSegment.x
    );

    // Eyes
    const eyeOffset = 7;
    const eyeSize = 5;
    
    const leftEyeX = headSegment.x + Math.cos(headAngle + 0.5) * eyeOffset;
    const leftEyeY = headSegment.y + Math.sin(headAngle + 0.5) * eyeOffset;
    const rightEyeX = headSegment.x + Math.cos(headAngle - 0.5) * eyeOffset;
    const rightEyeY = headSegment.y + Math.sin(headAngle - 0.5) * eyeOffset;

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
    ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(leftEyeX + Math.cos(headAngle) * 2, leftEyeY + Math.sin(headAngle) * 2, 2.5, 0, Math.PI * 2);
    ctx.arc(rightEyeX + Math.cos(headAngle) * 2, rightEyeY + Math.sin(headAngle) * 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Tongue
    const tongueFlick = Math.sin(Date.now() * 0.005) > 0.7;
    
    if (tongueFlick) {
      const tongueStartX = headSegment.x + Math.cos(headAngle) * 18;
      const tongueStartY = headSegment.y + Math.sin(headAngle) * 18;
      const tongueEndX = tongueStartX + Math.cos(headAngle) * 25;
      const tongueEndY = tongueStartY + Math.sin(headAngle) * 25;
      
      ctx.beginPath();
      ctx.moveTo(tongueStartX, tongueStartY);
      ctx.lineTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle + 0.3) * 8, tongueEndY + Math.sin(headAngle + 0.3) * 8);
      ctx.moveTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle - 0.3) * 8, tongueEndY + Math.sin(headAngle - 0.3) * 8);
      
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Glow
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(headSegment.x, headSegment.y, 30, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(headSegment.x, headSegment.y, 0, headSegment.x, headSegment.y, 40);
    glow.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }

  animate();
})();
