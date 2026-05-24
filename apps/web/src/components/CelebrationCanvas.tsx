import { useEffect, useRef } from 'react';

interface Confetti {
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
}

interface Firework {
  x: number;
  y: number;
  targetY: number;
  color: string;
  speedY: number;
  exploded: boolean;
  sparks: Spark[];
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
}

const COLORS = [
  '#F5C842', // Gold
  '#FF5E5E', // Red
  '#5D8CFF', // Blue
  '#34D399', // Green
  '#C084FC', // Purple
  '#FB7185', // Pink
  '#38BDF8', // Cyan
];

export default function CelebrationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const confettis: Confetti[] = [];
    const fireworks: Firework[] = [];

    // Initialize Confetti
    const spawnConfetti = (count: number) => {
      for (let i = 0; i < count; i++) {
        confettis.push({
          x: Math.random() * width,
          y: Math.random() * -height - 20,
          size: Math.random() * 8 + 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          speedY: Math.random() * 2 + 2,
          speedX: Math.random() * 2 - 1,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 4 - 2,
        });
      }
    };

    // Spawn initial confetti
    spawnConfetti(120);

    // Helper to spawn firework
    const spawnFirework = () => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      fireworks.push({
        x: Math.random() * (width - 200) + 100,
        y: height + 20,
        targetY: Math.random() * (height * 0.5) + height * 0.1,
        color,
        speedY: Math.random() * 3 + 6,
        exploded: false,
        sparks: [],
      });
    };

    let lastConfettiSpawn = Date.now();
    let lastFireworkSpawn = Date.now();

    const loop = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Confetti Engine
      if (confettis.length < 150 && Date.now() - lastConfettiSpawn > 300) {
        spawnConfetti(20);
        lastConfettiSpawn = Date.now();
      }

      for (let i = confettis.length - 1; i >= 0; i--) {
        const c = confettis[i];
        c.y += c.speedY;
        c.x += Math.sin(c.y / 30) * 0.8 + c.speedX;
        c.rotation += c.rotationSpeed;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rotation * Math.PI) / 180);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size / 2);
        ctx.restore();

        // Remove offscreen
        if (c.y > height + 20) {
          confettis.splice(i, 1);
        }
      }

      // 2. Firework Engine
      if (fireworks.length < 5 && Date.now() - lastFireworkSpawn > 1200) {
        spawnFirework();
        lastFireworkSpawn = Date.now();
      }

      for (let i = fireworks.length - 1; i >= 0; i--) {
        const f = fireworks[i];

        if (!f.exploded) {
          f.y -= f.speedY;
          // Rocket trail
          ctx.beginPath();
          ctx.arc(f.x, f.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();

          if (f.y <= f.targetY) {
            f.exploded = true;
            // Spawn sparks
            const count = Math.floor(Math.random() * 50) + 50;
            for (let j = 0; j < count; j++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 4 + 1.5;
              f.sparks.push({
                x: f.x,
                y: f.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: f.color,
                alpha: 1,
                life: Math.random() * 30 + 30,
              });
            }
          }
        } else {
          // Render explosion sparks
          let hasAliveSparks = false;
          for (let j = f.sparks.length - 1; j >= 0; j--) {
            const s = f.sparks[j];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.05; // gravity
            s.vx *= 0.98; // friction
            s.vy *= 0.98;
            s.life--;
            s.alpha = Math.max(0, s.life / 60);

            if (s.life > 0) {
              hasAliveSparks = true;
              ctx.beginPath();
              ctx.arc(s.x, s.y, Math.random() * 1.5 + 1, 0, Math.PI * 2);
              ctx.fillStyle = s.color;
              ctx.globalAlpha = s.alpha;
              ctx.shadowBlur = 6;
              ctx.shadowColor = s.color;
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.shadowBlur = 0;
            }
          }

          if (!hasAliveSparks) {
            fireworks.splice(i, 1);
          }
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
