/* effects.js - Fireworks + Sound helper (no dependencies)
Usage:
  1) Put this file in repo (e.g. assets/js/effects.js)
  2) Include BEFORE script.js:
     <script src="assets/js/effects.js" defer></script>
  3) In script.js timer loop call:
     Effects.maybeCelebrate(ev, Date.now(), { soundUrl: "assets/sfx/celebrate.wav" });
*/
(() => {
  const CELEBRATION_WINDOW_MS = 9000;
  const celebrated = new Set();
  let audioUnlocked = false;

  function unlockAudio(url){
    if (audioUnlocked) return;
    try{
      const a = new Audio(url);
      a.muted = true;
      a.play().then(()=>{
        a.pause(); a.currentTime = 0; a.muted = false;
        audioUnlocked = true;
      }).catch(()=>{});
    }catch(e){}
  }

  function getOccurrenceEndTimeMs(ev, nowMs){
    if (!ev?.date) return null;
    const base = new Date(ev.date);
    if (Number.isNaN(base.getTime())) return null;
    if (ev.yearly){
      const now = new Date(nowMs);
      const d = new Date(base);
      d.setFullYear(now.getFullYear());
      return d.getTime();
    }
    return base.getTime();
  }

  function maybeCelebrate(ev, nowMs, opts = {}){
    const soundUrl = opts.soundUrl || "assets/sfx/celebrate.wav";
    const endMs = getOccurrenceEndTimeMs(ev, nowMs);
    if (endMs == null) return;

    const diff = nowMs - endMs;
    if (diff < 0 || diff > CELEBRATION_WINDOW_MS) return;

    const key = `${ev.id}:${endMs}`;
    if (celebrated.has(key)) return;
    celebrated.add(key);

    launchFireworks(opts);
    playSound(soundUrl, opts);
  }

  function playSound(url, opts = {}){
    try{
      const a = new Audio(url);
      a.volume = (typeof opts.volume === "number") ? opts.volume : 0.9;
      if (!audioUnlocked) unlockAudio(url);
      a.play().catch(() => beep());
    }catch(e){ beep(); }
  }

  function beep(){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const pop = (t, f1, f2) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(f1, t);
        o.frequency.exponentialRampToValueAtTime(f2, t + 0.14);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.18);
      };
      const t = ctx.currentTime;
      pop(t, 880, 220); pop(t+0.14, 990, 250); pop(t+0.28, 740, 210);
      setTimeout(()=> ctx.close?.().catch(()=>{}), 800);
    }catch(e){}
  }

  function launchFireworks(opts = {}){
    const durationMs = typeof opts.durationMs === "number" ? opts.durationMs : 2600;
    let canvas = document.getElementById("fwCanvas");
    if (!canvas){
      canvas = document.createElement("canvas");
      canvas.id = "fwCanvas";
      Object.assign(canvas.style, {
        position: "fixed", inset: "0", width: "100%", height: "100%",
        pointerEvents: "none", zIndex: "9999"
      });
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const colors = opts.colors || ["#ffcc66","#72baff","#ff6b6b","#7CFFCB","#c4b5fd","#fca5a5"];
    const particles = [];
    let raf = null;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const burst = (x, y) => {
      const count = 92;
      for (let i=0;i<count;i++){
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 6 + 2;
        particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (Math.random()*2),
          life: 0, ttl: 55 + Math.random() * 40,
          size: 1.2 + Math.random() * 2.2,
          color: colors[(Math.random()*colors.length)|0]
        });
      }
    };

    for (let b=0; b<4; b++){
      burst(
        window.innerWidth * (0.2 + Math.random()*0.6),
        window.innerHeight * (0.16 + Math.random()*0.35)
      );
    }

    const start = performance.now();
    const draw = (now) => {
      const t = now - start;
      ctx.clearRect(0,0,window.innerWidth,window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--){
        const p = particles[i];
        p.life++;
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.10; p.vx *= 0.985; p.vy *= 0.985;

        const alpha = Math.max(0, 1 - p.life / p.ttl);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size*2, p.size*2);

        if (p.life >= p.ttl) particles.splice(i, 1);
      }
      ctx.globalAlpha = 1;

      if (t < durationMs && particles.length){
        raf = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
        if (raf) cancelAnimationFrame(raf);
      }
    };

    raf = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    setTimeout(()=> window.removeEventListener("resize", onResize), durationMs + 350);
  }

  window.addEventListener("pointerdown", () => unlockAudio("assets/sfx/celebrate.wav"), { once: true });

  window.Effects = { maybeCelebrate, launchFireworks, playSound, unlockAudio };
})();
