/* effects.js - Advanced Fireworks + Musical Synth */
(() => {
  const CELEBRATION_WINDOW_MS = 12000;
  const celebrated = new Set();
  let audioUnlocked = false;

  // --- Audio Logic ---
  function unlockAudio(url) {
    if (audioUnlocked) return;
    try {
      const a = new Audio(url);
      a.muted = true;
      a.play().then(() => {
        a.pause(); a.currentTime = 0; a.muted = false;
        audioUnlocked = true;
      }).catch(() => { });
    } catch (e) { }
  }

  function playSound(url, opts = {}) {
    try {
      const a = new Audio(url);
      a.volume = (typeof opts.volume === "number") ? opts.volume : 0.9;
      if (!audioUnlocked) unlockAudio(url);
      a.play().catch(() => playVictoryTune());
    } catch (e) { playVictoryTune(); }
  }

  // A simple victory melody using Web Audio OSC
  function playVictoryTune() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq, start, duration, type = 'sine') => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.1, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.05);
        o.connect(g); g.connect(ctx.destination);
        o.start(start); o.stop(start + duration);
      };

      const now = ctx.currentTime;
      // Melody: C5, E5, G5, C6 (Arpeggio)
      playTone(523.25, now, 0.2);       // C5
      playTone(659.25, now + 0.15, 0.2); // E5
      playTone(783.99, now + 0.30, 0.2); // G5
      playTone(1046.50, now + 0.45, 0.6, 'triangle'); // C6

      setTimeout(() => ctx.close?.().catch(() => { }), 2000);
    } catch (e) { }
  }

  // --- Date Logic ---
  function getOccurrenceEndTimeMs(ev, nowMs) {
    if (!ev?.date) return null;
    const base = new Date(ev.date);
    if (Number.isNaN(base.getTime())) return null;
    if (ev.yearly) {
      const now = new Date(nowMs);
      const d = new Date(base);
      d.setFullYear(now.getFullYear());
      return d.getTime();
    }
    return base.getTime();
  }

  // --- Main Trigger ---
  function maybeCelebrate(ev, nowMs, opts = {}) {
    const soundUrl = opts.soundUrl || "assets/sfx/celebrate.wav";
    const endMs = getOccurrenceEndTimeMs(ev, nowMs);
    if (endMs == null) return;

    const diff = nowMs - endMs;
    // Celebrate if within window AFTER end date
    if (diff < 0 || diff > CELEBRATION_WINDOW_MS) return;

    // Trigger per occurrence
    const key = `${ev.id}:${endMs}`;
    if (celebrated.has(key)) return;
    celebrated.add(key);

    launchFireworks(opts);
    playSound(soundUrl, opts);

    // Call callback for UI animation if provided
    if (typeof opts.onCelebrate === 'function') {
      opts.onCelebrate(ev.id);
    }
  }

  // --- Physics Particle System ---
  function launchFireworks(opts = {}) {
    const durationMs = opts.durationMs || 4000;

    let canvas = document.getElementById("fwCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "fwCanvas";
      // Fullscreen, top-most, click-through
      Object.assign(canvas.style, {
        position: "fixed", inset: "0", width: "100%", height: "100%",
        pointerEvents: "none", zIndex: "9999"
      });
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    let particles = [];
    let raf = null;

    // Vibrant colors
    const colors = ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#a78bfa", "#f87171", "#ffffff"];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Create a firework explosion
    const createExplosion = (x, y) => {
      const particleCount = 80 + Math.random() * 50;
      for (let i = 0; i < particleCount; i++) {
        const speed = Math.random() * 5 + 2;
        const angle = Math.random() * Math.PI * 2;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.01 + Math.random() * 0.015,
          color: color,
          gravity: 0.08,
          size: Math.random() * 3 + 1
        });
      }
    };

    // Initial bursts
    createExplosion(window.innerWidth * 0.5, window.innerHeight * 0.4);
    setTimeout(() => createExplosion(window.innerWidth * 0.3, window.innerHeight * 0.3), 400);
    setTimeout(() => createExplosion(window.innerWidth * 0.7, window.innerHeight * 0.3), 800);
    setTimeout(() => createExplosion(window.innerWidth * 0.5, window.innerHeight * 0.2), 1200);

    const startTime = performance.now();

    const loop = (now) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); // clear frame

      // Update & Draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity; // Gravity
        p.vx *= 0.96; // Friction
        p.vy *= 0.96;
        p.life -= p.decay;
        p.size *= 0.98;

        if (p.life <= 0 || p.size < 0.1) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        // Draw circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Optional: Draw simple trail
        // ctx.fillStyle = 'rgba(255,255,255,0.2)';
        // ctx.fillRect(p.x - p.vx, p.y - p.vy, 2, 2); 
      }
      ctx.globalAlpha = 1;

      if (elapsed < durationMs || particles.length > 0) {
        raf = requestAnimationFrame(loop);
      } else {
        // Cleanup
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    raf = requestAnimationFrame(loop);

    // Auto-resize handler
    const onResize = () => resize();
    window.addEventListener("resize", onResize, { passive: true });
    // Remove listener after animation
    setTimeout(() => window.removeEventListener("resize", onResize), durationMs + 1000);
  }

  // Pre-unlock audio on user interaction
  window.addEventListener("pointerdown", () => unlockAudio("assets/sfx/celebrate.wav"), { once: true });

  // Export
  // --- Tick Sound ---
  function playTick() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const t = ctx.currentTime;

      // Create a short, high-pitched "tick"
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.05); // quick drop

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);

      // Cleanup to prevent memory leaks from many contexts
      setTimeout(() => ctx.close(), 100);
    } catch (e) {
      // ignore
    }
  }

  window.Effects = { maybeCelebrate, launchFireworks, playSound, playTick };
})();
