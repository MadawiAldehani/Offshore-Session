"use client";

/**
 * Tiny canvas confetti — written by hand so the demo has no runtime deps.
 *
 * `fireConfetti(canvas)` launches a burst from the lower corners and returns a
 * stop function. Particles are simple physics: velocity, gravity, drag, spin.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  life: number;
}

const COLORS = ["#ffb020", "#ffc94d", "#22d3ee", "#67e8f9", "#ffffff", "#f97316"];

const GRAVITY = 0.32;
const DRAG = 0.992;

export function fireConfetti(
  canvas: HTMLCanvasElement,
  options: { particles?: number; durationMs?: number } = {},
): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};

  const count = options.particles ?? 220;
  const duration = options.durationMs ?? 4200;

  // Match the backing store to the device pixel ratio or it renders blurry on
  // a retina laptop driving a projector.
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
  };
  resize();

  const width = () => canvas.width;
  const height = () => canvas.height;

  const particles: Particle[] = [];

  // Two cannons, angled inward from the bottom corners.
  for (let i = 0; i < count; i += 1) {
    const fromLeft = i % 2 === 0;
    const spread = (Math.random() - 0.5) * 0.9;
    const power = (12 + Math.random() * 11) * ratio;
    const angle = (fromLeft ? -Math.PI / 3 : (-Math.PI * 2) / 3) + spread;
    particles.push({
      x: fromLeft ? 0 : width(),
      y: height() * (0.95 + Math.random() * 0.1),
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      size: (5 + Math.random() * 7) * ratio,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    });
  }

  let frame = 0;
  let stopped = false;
  const startedAt = performance.now();

  const render = (now: number) => {
    if (stopped) return;
    const elapsed = now - startedAt;
    context.clearRect(0, 0, width(), height());

    for (const particle of particles) {
      particle.vy += GRAVITY * ratio;
      particle.vx *= DRAG;
      particle.vy *= DRAG;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;
      // Fade out over the last third of the run.
      particle.life = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.6) / (duration * 0.4));

      if (particle.life <= 0 || particle.y > height() + 60 * ratio) continue;

      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.globalAlpha = particle.life;
      context.fillStyle = particle.color;
      // Rectangles read as paper streamers at projector distance.
      context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      context.restore();
    }

    if (elapsed < duration) {
      frame = requestAnimationFrame(render);
    } else {
      context.clearRect(0, 0, width(), height());
    }
  };

  frame = requestAnimationFrame(render);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    context.clearRect(0, 0, width(), height());
  };
}
