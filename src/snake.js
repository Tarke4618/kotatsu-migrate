// src/snake.js - Realistic Fierce Snake that follows mouse/touch

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

  // Snake segments - more for smoother bending
  const segmentCount = 60;
  const segments = [];
  const segmentLength = 10;
  
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

    // Head follows mouse with easing
    const head = segments[0];
    const dx = mouseX - head.x;
    const dy = mouseY - head.y;
    head.x += dx * 0.12;
    head.y += dy * 0.12;

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

    // Calculate head angle for direction
    const headSegment = segments[0];
    const nextSegment = segments[1];
    const headAngle = Math.atan2(
      headSegment.y - nextSegment.y,
      headSegment.x - nextSegment.x
    );

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw shadow first
    ctx.globalAlpha = 0.3;
    for (let i = segmentCount - 1; i >= 0; i--) {
      const segment = segments[i];
      const progress = i / segmentCount;
      const baseWidth = 28;
      const width = baseWidth * (1 - progress * 0.75);
      
      ctx.beginPath();
      ctx.arc(segment.x + 5, segment.y + 5, width, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
    }

    // Draw main body with realistic scales
    ctx.globalAlpha = 0.65;
    for (let i = segmentCount - 1; i >= 0; i--) {
      const segment = segments[i];
      const progress = i / segmentCount;
      
      // Body width - thicker in middle, tapering at ends
      const baseWidth = 28;
      const headTaper = i < 5 ? 0.85 + (i / 5) * 0.15 : 1;
      const width = baseWidth * (1 - progress * 0.75) * headTaper;
      
      // Realistic snake colors - golden/olive with darker markings
      const r = Math.floor(200 - progress * 60 + Math.sin(i * 0.3) * 20);
      const g = Math.floor(160 - progress * 80 + Math.sin(i * 0.3) * 15);
      const b = Math.floor(40 + Math.sin(i * 0.5) * 20);
      
      // Main body segment
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, width, 0, Math.PI * 2);
      const bodyGrad = ctx.createRadialGradient(
        segment.x - width * 0.3, segment.y - width * 0.3, 0,
        segment.x, segment.y, width
      );
      bodyGrad.addColorStop(0, `rgb(${r + 40}, ${g + 30}, ${b + 20})`);
      bodyGrad.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
      bodyGrad.addColorStop(1, `rgb(${r - 40}, ${g - 40}, ${b})`);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    }

    // Draw diamond scale pattern
    ctx.globalAlpha = 0.4;
    for (let i = 3; i < segmentCount - 4; i += 2) {
      const segment = segments[i];
      const prevSeg = segments[i - 1];
      const progress = i / segmentCount;
      const width = 28 * (1 - progress * 0.75);
      
      const angle = Math.atan2(segment.y - prevSeg.y, segment.x - prevSeg.x);
      
      // Diamond shape
      ctx.save();
      ctx.translate(segment.x, segment.y);
      ctx.rotate(angle);
      
      ctx.beginPath();
      ctx.moveTo(0, -width * 0.5);
      ctx.lineTo(width * 0.4, 0);
      ctx.lineTo(0, width * 0.5);
      ctx.lineTo(-width * 0.4, 0);
      ctx.closePath();
      
      ctx.fillStyle = `rgba(80, 60, 20, ${0.3 - progress * 0.2})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(60, 40, 10, ${0.4 - progress * 0.2})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    }

    // Draw fierce head
    ctx.globalAlpha = 0.8;
    
    // Head shape - more triangular and menacing
    const headWidth = 32;
    ctx.save();
    ctx.translate(headSegment.x, headSegment.y);
    ctx.rotate(headAngle);
    
    // Main head
    ctx.beginPath();
    ctx.moveTo(25, 0);  // Snout tip
    ctx.quadraticCurveTo(15, -headWidth * 0.6, -10, -headWidth * 0.5);
    ctx.quadraticCurveTo(-20, 0, -10, headWidth * 0.5);
    ctx.quadraticCurveTo(15, headWidth * 0.6, 25, 0);
    
    const headGrad = ctx.createLinearGradient(-20, 0, 25, 0);
    headGrad.addColorStop(0, 'rgb(140, 110, 40)');
    headGrad.addColorStop(0.5, 'rgb(180, 150, 50)');
    headGrad.addColorStop(1, 'rgb(160, 130, 45)');
    ctx.fillStyle = headGrad;
    ctx.fill();
    
    // Head scales texture
    ctx.strokeStyle = 'rgba(100, 80, 30, 0.5)';
    ctx.lineWidth = 1;
    for (let i = -15; i < 20; i += 8) {
      ctx.beginPath();
      ctx.arc(i, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Brow ridges - makes it look fierce
    ctx.beginPath();
    ctx.moveTo(5, -12);
    ctx.quadraticCurveTo(0, -18, -10, -16);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgb(120, 90, 30)';
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(5, 12);
    ctx.quadraticCurveTo(0, 18, -10, 16);
    ctx.stroke();
    
    // Menacing eyes - slitted pupils
    ctx.globalAlpha = 1;
    const eyeX = 0;
    const eyeY1 = -10;
    const eyeY2 = 10;
    const eyeSize = 8;
    
    // Eye sockets (dark)
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY1, eyeSize + 2, eyeSize, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeX, eyeY2, eyeSize + 2, eyeSize, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(30, 20, 10)';
    ctx.fill();
    
    // Eye whites (yellowish)
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY1, eyeSize, eyeSize - 1, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeX, eyeY2, eyeSize, eyeSize - 1, 0, 0, Math.PI * 2);
    const eyeGrad = ctx.createRadialGradient(eyeX, eyeY1, 0, eyeX, eyeY1, eyeSize);
    eyeGrad.addColorStop(0, '#FFEE00');
    eyeGrad.addColorStop(0.7, '#DDAA00');
    eyeGrad.addColorStop(1, '#AA7700');
    ctx.fillStyle = eyeGrad;
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY2, eyeSize, eyeSize - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Vertical slitted pupils - very menacing
    ctx.beginPath();
    ctx.ellipse(eyeX + 1, eyeY1, 2, eyeSize - 2, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeX + 1, eyeY2, 2, eyeSize - 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    
    // Eye shine
    ctx.beginPath();
    ctx.arc(eyeX - 2, eyeY1 - 2, 2, 0, Math.PI * 2);
    ctx.arc(eyeX - 2, eyeY2 - 2, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
    
    // Nostrils
    ctx.beginPath();
    ctx.ellipse(18, -4, 2, 1.5, 0.3, 0, Math.PI * 2);
    ctx.ellipse(18, 4, 2, 1.5, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    
    ctx.restore();

    // Forked tongue - flicks more often and faster
    const tongueTime = Date.now() * 0.008;
    const tongueFlick = Math.sin(tongueTime) > 0.5;
    
    if (tongueFlick) {
      const tongueLength = 40;
      const tongueStartX = headSegment.x + Math.cos(headAngle) * 28;
      const tongueStartY = headSegment.y + Math.sin(headAngle) * 28;
      const tongueWave = Math.sin(Date.now() * 0.03) * 3;
      
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(tongueStartX, tongueStartY);
      
      // Wavy tongue
      const midX = tongueStartX + Math.cos(headAngle) * tongueLength * 0.6;
      const midY = tongueStartY + Math.sin(headAngle) * tongueLength * 0.6 + tongueWave;
      
      const tongueEndX = tongueStartX + Math.cos(headAngle) * tongueLength;
      const tongueEndY = tongueStartY + Math.sin(headAngle) * tongueLength;
      
      ctx.quadraticCurveTo(midX, midY, tongueEndX, tongueEndY);
      
      // Fork
      ctx.lineTo(tongueEndX + Math.cos(headAngle + 0.4) * 15, tongueEndY + Math.sin(headAngle + 0.4) * 15);
      ctx.moveTo(tongueEndX, tongueEndY);
      ctx.lineTo(tongueEndX + Math.cos(headAngle - 0.4) * 15, tongueEndY + Math.sin(headAngle - 0.4) * 15);
      
      ctx.strokeStyle = '#CC0000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Tongue detail
      ctx.strokeStyle = '#FF3333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tongueStartX, tongueStartY);
      ctx.quadraticCurveTo(midX, midY, tongueEndX, tongueEndY);
      ctx.stroke();
    }

    // Subtle glow around head
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(headSegment.x, headSegment.y, 45, 0, Math.PI * 2);
    const glowGrad = ctx.createRadialGradient(
      headSegment.x, headSegment.y, 0,
      headSegment.x, headSegment.y, 50
    );
    glowGrad.addColorStop(0, 'rgba(255, 200, 50, 0.4)');
    glowGrad.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fill();

    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }

  animate();
})();
