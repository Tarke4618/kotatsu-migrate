// src/snake.js - Interactive Snake that follows mouse/touch with improved physics

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

  // Snake segments with velocity for physics
  const segmentCount = 50;
  const segments = [];
  const segmentLength = 12;
  
  // Initialize segments at center
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0,
      vy: 0,
    });
  }

  // Mouse position
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let targetX = mouseX;
  let targetY = mouseY;

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

  // Physics constants
  const OFFSET = 3; // 3px behind cursor
  const SPRING = 0.15;
  const DAMPING = 0.85;
  const TENSION = 0.4;

  // Animation with improved physics
  function animate() {
    ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    // Calculate target position (3px behind cursor based on movement direction)
    const head = segments[0];
    const dx = mouseX - head.x;
    const dy = mouseY - head.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0.1) {
      // Target is 3px behind cursor in the direction of movement
      targetX = mouseX - (dx / dist) * OFFSET;
      targetY = mouseY - (dy / dist) * OFFSET;
    }

    // Spring physics for head
    const ax = (targetX - head.x) * SPRING;
    const ay = (targetY - head.y) * SPRING;
    head.vx = (head.vx + ax) * DAMPING;
    head.vy = (head.vy + ay) * DAMPING;
    head.x += head.vx;
    head.y += head.vy;

    // Each segment follows with spring physics
    for (let i = 1; i < segmentCount; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];
      
      const segDx = prev.x - curr.x;
      const segDy = prev.y - curr.y;
      const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
      
      if (segDist > segmentLength) {
        const angle = Math.atan2(segDy, segDx);
        const targetSegX = prev.x - Math.cos(angle) * segmentLength;
        const targetSegY = prev.y - Math.sin(angle) * segmentLength;
        
        // Spring physics for each segment
        const segAx = (targetSegX - curr.x) * TENSION;
        const segAy = (targetSegY - curr.y) * TENSION;
        curr.vx = (curr.vx + segAx) * DAMPING;
        curr.vy = (curr.vy + segAy) * DAMPING;
        curr.x += curr.vx;
        curr.y += curr.vy;
      }
    }

    // Set global alpha for transparency
    ctx.globalAlpha = 0.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw smooth body using bezier curves
    if (segmentCount > 2) {
      ctx.beginPath();
      ctx.moveTo(segments[0].x, segments[0].y);
      
      for (let i = 1; i < segmentCount - 1; i++) {
        const curr = segments[i];
        const next = segments[i + 1];
        const cpx = (curr.x + next.x) / 2;
        const cpy = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, cpx, cpy);
      }
      
      // Draw with gradient stroke
      const bodyGrad = ctx.createLinearGradient(
        segments[0].x, segments[0].y,
        segments[segmentCount - 1].x, segments[segmentCount - 1].y
      );
      bodyGrad.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
      bodyGrad.addColorStop(0.5, 'rgba(255, 180, 0, 0.7)');
      bodyGrad.addColorStop(1, 'rgba(200, 130, 0, 0.3)');
      ctx.strokeStyle = bodyGrad;
      ctx.lineWidth = 40;
      ctx.stroke();
      
      // Inner highlight
      ctx.strokeStyle = 'rgba(255, 240, 150, 0.3)';
      ctx.lineWidth = 20;
      ctx.stroke();
    }

    // Draw body circles for texture
    for (let i = segmentCount - 1; i >= 0; i--) {
      const segment = segments[i];
      const progress = i / segmentCount;
      
      const baseWidth = 22;
      const width = baseWidth * (1 - progress * 0.7);
      
      const brightness = 255 - progress * 80;
      const green = Math.floor(200 - progress * 100);
      
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, width, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${brightness}, ${green}, 0, 0.5)`;
      ctx.fill();
    }
    
    // Scale pattern
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

    const pupilOffset = 2;
    ctx.beginPath();
    ctx.arc(leftEyeX + Math.cos(headAngle) * pupilOffset, leftEyeY + Math.sin(headAngle) * pupilOffset, 2.5, 0, Math.PI * 2);
    ctx.arc(rightEyeX + Math.cos(headAngle) * pupilOffset, rightEyeY + Math.sin(headAngle) * pupilOffset, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Tongue
    const tongueTime = Date.now() * 0.005;
    const tongueFlick = Math.sin(tongueTime) > 0.7;
    
    if (tongueFlick) {
      const tongueLength = 25;
      const tongueStartX = headSegment.x + Math.cos(headAngle) * 18;
      const tongueStartY = headSegment.y + Math.sin(headAngle) * 18;
      
      ctx.beginPath();
      ctx.moveTo(tongueStartX, tongueStartY);
      
      const tongueEndX = tongueStartX + Math.cos(headAngle) * tongueLength;
      const tongueEndY = tongueStartY + Math.sin(headAngle) * tongueLength;
      
      ctx.lineTo(tongueEndX, tongueEndY);
      ctx.moveTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle + 0.3) * 8, tongueEndY + Math.sin(headAngle + 0.3) * 8);
      ctx.moveTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle - 0.3) * 8, tongueEndY + Math.sin(headAngle - 0.3) * 8);
      
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Subtle glow
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(headSegment.x, headSegment.y, 30, 0, Math.PI * 2);
    const headGlow = ctx.createRadialGradient(
      headSegment.x, headSegment.y, 0,
      headSegment.x, headSegment.y, 40
    );
    headGlow.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    headGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = headGlow;
    ctx.fill();

    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }

  animate();
})();
