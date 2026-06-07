(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'gh-particles';
  Object.assign(canvas.style, {
    position: 'fixed', top: 0, left: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: 9999,
    opacity: 0.55
  });
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x: -999, y: -999 };
  const COUNT = 130, LINK = 120, REPEL = 90, SPEED = 0.35;
  const COLORS = ['rgba(59,130,246,', 'rgba(96,165,250,', 'rgba(99,102,241,', 'rgba(14,165,233,'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * SPEED;
    this.vy = (Math.random() - 0.5) * SPEED;
    this.r  = Math.random() * 1.5 + 0.5;
    this.col = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.alpha = Math.random() * 0.5 + 0.25;
  }

  function init() {
    particles = [];
    for (let i = 0; i < COUNT; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];

      // repel from mouse
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REPEL) {
        const force = (REPEL - dist) / REPEL * 1.2;
        p.vx += (dx / dist) * force * 0.06;
        p.vy += (dy / dist) * force * 0.06;
      }

      // dampen speed
      p.vx *= 0.99; p.vy *= 0.99;

      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      // draw dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.col + p.alpha + ')';
      ctx.fill();

      // draw lines to nearby particles
      for (let j = i + 1; j < COUNT; j++) {
        const q = particles[j];
        const lx = p.x - q.x, ly = p.y - q.y;
        const ld = Math.sqrt(lx * lx + ly * ly);
        if (ld < LINK) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          const a = (1 - ld / LINK) * 0.18;
          ctx.strokeStyle = 'rgba(59,130,246,' + a + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
  window.addEventListener('resize', () => { resize(); init(); });

  resize(); init(); draw();
})();
