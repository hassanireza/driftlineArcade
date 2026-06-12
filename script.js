(() => {
  "use strict";

  /* ──────────────────────────────────────────────────────────
     KEYBOARD ACCESSIBILITY
  ────────────────────────────────────────────────────────── */
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const wasActive = panel.dataset.active === "true";
        document.querySelectorAll(".panel").forEach((p) => {
          p.dataset.active = "false";
          p.setAttribute("aria-expanded", "false");
        });
        if (!wasActive) {
          panel.dataset.active = "true";
          panel.setAttribute("aria-expanded", "true");
        }
      }
    });
    panel.addEventListener("focus", () => panel.setAttribute("aria-expanded", "true"));
    panel.addEventListener("blur", () => {
      panel.setAttribute("aria-expanded", "false");
      panel.dataset.active = "false";
    });
  });

  /* Touch tap-to-expand */
  const mql = window.matchMedia("(hover: none)");
  function applyTouchBehavior(isTouchOnly) {
    if (!isTouchOnly) return;
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.addEventListener("click", () => {
        const already = panel.classList.contains("panel--active");
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("panel--active"));
        if (!already) panel.classList.add("panel--active");
      });
    });
  }
  applyTouchBehavior(mql.matches);
  mql.addEventListener("change", (e) => applyTouchBehavior(e.matches));


  /* ──────────────────────────────────────────────────────────
     SKYFOLD CANVAS
  ────────────────────────────────────────────────────────── */
  (function initSkyfold() {
    const canvas = document.getElementById("skyfold-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, elapsed = 0, raf;

    // ── Laser shot state: fires for 180ms every ~2.2s
    const LASER_INTERVAL = 2200;   // ms between shots
    const LASER_DURATION =  180;   // ms beam stays visible
    let laserTimer = 800;          // start first shot after 0.8s

    /* Motes */
    const motes = [];
    function makeMote(anyY) {
      return {
        x: Math.random(),
        y: anyY ? Math.random() : -0.02,
        size: Math.random() * 2.4 + 0.8,
        speed: (Math.random() * 8 + 4) / 10000,
        color: Math.random() > 0.5 ? "#fff8eb" : "#f4b29f"
      };
    }
    function resetMotes(count) {
      motes.length = 0;
      for (let i = 0; i < count; i++) motes.push(makeMote(true));
    }

    /* Terraces */
    const terraces = [];
    function makeTerrace(anyY) {
      const hue = Math.random();
      return {
        x: Math.random(),
        y: anyY ? Math.random() : -0.08,
        w: Math.random() * 120 + 90,
        h: Math.random() * 38 + 28,
        d: Math.random() * 44 + 28,
        speed: (Math.random() * 5 + 3) / 10000,
        hue
      };
    }
    function resetTerraces(count) {
      terraces.length = 0;
      for (let i = 0; i < count; i++) terraces.push(makeTerrace(true));
    }

    function drawIsoBlock(cx, cy, w, h, d, hue) {
      const top   = hue > 0.66 ? "#fff4d8" : hue > 0.33 ? "#eaf0d7" : "#f9eadf";
      const left  = hue > 0.66 ? "#d98aa0" : hue > 0.33 ? "#97cbbf" : "#e7b58f";
      const right = hue > 0.66 ? "#6a5d8f" : hue > 0.33 ? "#6fa9b5" : "#d28e79";
      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.moveTo(0, -h/2); ctx.lineTo(w/2, 0); ctx.lineTo(0, h/2); ctx.lineTo(-w/2, 0);
      ctx.closePath(); ctx.fillStyle = top; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w/2, 0); ctx.lineTo(0, h/2); ctx.lineTo(0, h/2+d); ctx.lineTo(-w/2, d);
      ctx.closePath(); ctx.fillStyle = left; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(0, h/2); ctx.lineTo(0, h/2+d); ctx.lineTo(w/2, d);
      ctx.closePath(); ctx.fillStyle = right; ctx.fill();
      ctx.strokeStyle = "rgba(66,60,82,0.12)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    // Returns the current glider world position
    function gliderPos(t) {
      return {
        px: W * 0.42 + Math.sin(t * 0.00038) * W * 0.06,
        py: H * 0.46 + Math.cos(t * 0.00052) * H * 0.04,
        aim: -Math.PI/2 + Math.sin(t * 0.00045) * 0.18
      };
    }

    function drawGlider(t) {
      const { px, py, aim } = gliderPos(t);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(aim + Math.PI/2);
      ctx.shadowColor = "rgba(106,93,143,0.42)";
      ctx.shadowBlur = 18;
      // Body
      ctx.fillStyle = "#fff8eb"; ctx.strokeStyle = "#6a5d8f"; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -24); ctx.lineTo(18, 15); ctx.lineTo(4, 9);
      ctx.lineTo(0, 22); ctx.lineTo(-4, 9); ctx.lineTo(-18, 15);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Cockpit
      ctx.fillStyle = "#e77b69";
      ctx.beginPath();
      ctx.moveTo(0, -19); ctx.lineTo(7, 7); ctx.lineTo(0, 13); ctx.lineTo(-7, 7);
      ctx.closePath(); ctx.fill();
      // Wing lines
      ctx.strokeStyle = "rgba(106,93,143,0.28)";
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(0, 20);
      ctx.moveTo(-15, 12); ctx.lineTo(0, 1); ctx.lineTo(15, 12);
      ctx.stroke();
      ctx.restore();
    }

    // Draw beam only when laserTimer says it's firing
    function drawGliderBeam(t, laserAge) {
      if (laserAge < 0 || laserAge > LASER_DURATION) return;
      const { px, py, aim } = gliderPos(t);
      // Fade: full at 0ms, gone at LASER_DURATION
      const progress = laserAge / LASER_DURATION;
      const alpha = (1 - progress) * 0.85;
      const beamLen = 100 + Math.sin(t * 0.0011) * 15;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(aim + Math.PI/2);
      ctx.lineCap = "round";
      // Glow
      ctx.strokeStyle = "#e09040"; ctx.lineWidth = 5; ctx.globalAlpha = alpha * 0.35;
      ctx.shadowColor = "#e09040"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -22 - beamLen); ctx.stroke();
      // Core
      ctx.lineWidth = 2.5; ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -22 - beamLen); ctx.stroke();
      ctx.restore();
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = rect.width || window.innerWidth / 2;
      H = rect.height || window.innerHeight;
      canvas.width  = Math.ceil(W);
      canvas.height = Math.ceil(H);
      resetMotes(Math.min(70, Math.max(28, Math.round(W * H / 14000))));
      resetTerraces(Math.max(7, Math.round(H / 100)));
    }

    function tick(ts) {
      const dt = Math.min(ts - (tick._last || ts), 50);
      tick._last = ts;
      elapsed += dt;

      // Advance laser timer
      laserTimer -= dt;
      if (laserTimer < -LASER_DURATION) laserTimer = LASER_INTERVAL;
      // laserAge: 0..LASER_DURATION = firing, negative = waiting
      const laserAge = laserTimer < 0 ? -laserTimer : -1;

      for (const m of motes) {
        m.y += m.speed * dt;
        if (m.y > 1.04) Object.assign(m, makeMote(false));
      }
      for (const t of terraces) {
        t.y += t.speed * dt;
        if (t.y > 1.06) Object.assign(t, makeTerrace(false));
      }

      ctx.clearRect(0, 0, W, H);

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,    "#f6c5b2");
      grad.addColorStop(0.38, "#f4dfbf");
      grad.addColorStop(0.72, "#b8dced");
      grad.addColorStop(1,    "#79b5c6");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

      // Grid lines (slow drift)
      ctx.save();
      ctx.globalAlpha = 0.10; ctx.strokeStyle = "#fff8eb"; ctx.lineWidth = 1;
      const gap = 72;
      const off = (elapsed * 0.0015) % gap;
      for (let y = -gap + off; y < H + gap; y += gap) {
        ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(W+40, y-45); ctx.stroke();
      }
      for (let x = -gap; x < W + gap; x += gap) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H*0.72, H); ctx.stroke();
      }
      ctx.restore();

      // Terraces
      const scale = H / 600;
      for (const t of terraces) {
        drawIsoBlock(t.x * W, t.y * H, t.w * scale, t.h * scale, t.d * scale, t.hue);
      }

      // Motes
      ctx.save();
      for (const m of motes) {
        ctx.globalAlpha = 0.55; ctx.fillStyle = m.color;
        ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Glider + intermittent beam
      drawGliderBeam(elapsed, laserAge);
      drawGlider(elapsed);

      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement);
    resize();
    raf = requestAnimationFrame(tick);
  })();


  /* ──────────────────────────────────────────────────────────
     VOIDRUNNER CANVAS
  ────────────────────────────────────────────────────────── */
  (function initVoidrunner() {
    const canvas = document.getElementById("void-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let W = 0, H = 0, elapsed = 0, distance = 0, raf;

    const GROUND_FRAC = 0.78;
    const LASER_COLOR = "#22d3ee";

    // ── Laser shot state
    const LASER_INTERVAL = 2000;
    const LASER_DURATION = 200;
    let laserTimer = 600;

    /* Stars */
    const stars = [];
    function resetStars() {
      stars.length = 0;
      const count = Math.min(120, Math.max(40, Math.round(W * H / 6000)));
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.72,
          size: Math.random() > 0.85 ? 2 : 1,
          pulse: Math.random() * Math.PI * 2,
          color: Math.random() > 0.85 ? "#a78bfa" : "#f4effb"
        });
      }
    }

    /* Dunes */
    const dunes = [];
    function resetDunes() {
      dunes.length = 0;
      for (let i = 0; i < 14; i++) {
        dunes.push({
          x: Math.random() * (W + 80),
          y: GROUND_FRAC * H + 8 + Math.random() * 18,
          w: Math.random() * 44 + 18,
          h: Math.random() * 12 + 6
        });
      }
    }

    function wrap(v, max) { return ((v % max) + max) % max; }

    function drawMoon(x, y, r, color, shadow) {
      const px = wrap(x, W + r*4) - r*2;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, y * H, r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.arc(px + r*0.32, y*H - r*0.18, r*0.68, 0, Math.PI*2); ctx.fill();
    }

    function drawMountains(offset, color, heightFrac, peaks) {
      const GROUND = GROUND_FRAC * H;
      const width = W * 1.8;
      const step = width / peaks;
      const start = -wrap(offset, width);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, GROUND + 1);
      for (let rep = 0; rep < 3; rep++) {
        for (let i = 0; i <= peaks; i++) {
          const x = start + rep * width + i * step;
          const y = GROUND - heightFrac * H * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + 0.6)));
          ctx.lineTo(x, GROUND); ctx.lineTo(x + step * 0.5, y); ctx.lineTo(x + step, GROUND);
        }
      }
      ctx.lineTo(W, GROUND + 1); ctx.closePath(); ctx.fill();
    }

    function drawBackground() {
      const GROUND = GROUND_FRAC * H;
      ctx.fillStyle = "#07050a"; ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.save();
      const skyShift = distance * 0.035;
      for (const s of stars) {
        const x = wrap(s.x - skyShift, W);
        const alpha = 0.35 + Math.sin(s.pulse + distance * 0.018) * 0.24;
        ctx.fillStyle = s.color; ctx.globalAlpha = Math.max(0.18, alpha);
        ctx.fillRect(Math.round(x), Math.round(s.y), s.size, s.size);
      }
      ctx.restore();

      // Mars — anchored to far right, above text area
      const marsR = Math.min(W * 0.20, H * 0.17);
      // Fixed to right side: center at 88% of W so it's clearly right-aligned
      const marsX = W * 0.88;
      const marsY = H * 0.21;

      // Atmosphere glow
      ctx.save();
      const atmo = ctx.createRadialGradient(marsX, marsY, marsR * 0.6, marsX, marsY, marsR * 1.55);
      atmo.addColorStop(0, "rgba(193,68,14,0.20)");
      atmo.addColorStop(1, "rgba(193,68,14,0)");
      ctx.fillStyle = atmo; ctx.fillRect(marsX - marsR*2, marsY - marsR*2, marsR*4, marsR*4);
      ctx.restore();

      // Surface
      const marsGrad = ctx.createRadialGradient(
        marsX - marsR * 0.28, marsY - marsR * 0.22, marsR * 0.1,
        marsX, marsY, marsR
      );
      marsGrad.addColorStop(0,   "#ff8055");
      marsGrad.addColorStop(0.5, "#c1440e");
      marsGrad.addColorStop(1,   "#7a2008");
      ctx.fillStyle = marsGrad;
      ctx.beginPath(); ctx.arc(marsX, marsY, marsR, 0, Math.PI*2); ctx.fill();

      // Craters
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = "#a03010";
      ctx.beginPath(); ctx.arc(marsX - marsR*0.18, marsY - marsR*0.14, marsR*0.16, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(marsX + marsR*0.22, marsY + marsR*0.12, marsR*0.11, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(marsX - marsR*0.04, marsY + marsR*0.24, marsR*0.07, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // Rim glow
      ctx.save(); ctx.globalAlpha = 0.32;
      ctx.strokeStyle = "#ff9060"; ctx.lineWidth = marsR * 0.04;
      ctx.beginPath(); ctx.arc(marsX, marsY, marsR, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.10; ctx.strokeStyle = "#ff6030"; ctx.lineWidth = marsR * 0.08;
      ctx.beginPath(); ctx.arc(marsX, marsY, marsR * 1.06, 0, Math.PI*2); ctx.stroke();
      ctx.restore();

      // Shadow crescent
      const shadowGrad = ctx.createRadialGradient(
        marsX + marsR * 0.4, marsY + marsR * 0.2, marsR * 0.15,
        marsX, marsY, marsR
      );
      shadowGrad.addColorStop(0, "rgba(10,3,1,0)");
      shadowGrad.addColorStop(0.7, "rgba(10,3,1,0.45)");
      shadowGrad.addColorStop(1, "rgba(10,3,1,0.75)");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath(); ctx.arc(marsX, marsY, marsR, 0, Math.PI*2); ctx.fill();

      // Mountains
      drawMountains(distance * 0.15, "#210c08", 0.135, 8);
      drawMountains(distance * 0.38, "#4a1608", 0.105, 11);

      // Ground strip
      ctx.fillStyle = "#5c2010"; ctx.fillRect(0, GROUND + 5, W, H - GROUND);
      ctx.fillStyle = "#8d3615"; ctx.fillRect(0, GROUND + 10, W, H - GROUND);
      ctx.fillStyle = "#c1440e"; ctx.fillRect(0, GROUND, W, 5);
      ctx.fillStyle = "#2d0d07"; ctx.fillRect(0, GROUND + 5, W, 4);

      // Dunes
      for (const d of dunes) {
        const x = wrap(d.x - distance * 0.72, W + 80) - 40;
        ctx.fillStyle = "#351009";
        ctx.fillRect(Math.round(x), Math.round(d.y), d.w, d.h);
      }

      // Ground grid
      ctx.save();
      ctx.strokeStyle = "#7b4af5"; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
      ctx.globalAlpha = 0.18; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(0, GROUND+28); ctx.lineTo(W, GROUND+28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, GROUND+56); ctx.lineTo(W, GROUND+56); ctx.stroke();
      const vl = [[0.2,0.12],[0.4,0.28],[0.6,0.48],[0.8,0.68]];
      for (const [fx, fx2] of vl) {
        ctx.beginPath(); ctx.moveTo(fx * W, GROUND); ctx.lineTo(fx2 * W, H); ctx.stroke();
      }
      ctx.restore();
    }

    // Runner is at 60% of W — clear of the left-side text
    function runnerX() { return W * 0.60; }

    function drawRunner(t) {
      const GROUND = GROUND_FRAC * H;
      const scale = H / 380;
      const px = Math.round(runnerX());
      const py = Math.round(GROUND);
      const stride = Math.round(Math.sin(t * 0.0085) * 6 * scale);
      const core = Math.sin(t * 0.0085 * 4) > 0 ? "#22d3ee" : "#a78bfa";

      ctx.save(); ctx.imageSmoothingEnabled = false;

      function r(x, y, w, h) {
        ctx.fillRect(
          Math.round(px + x * scale),
          Math.round(py + y * scale),
          Math.max(1, Math.round(w * scale)),
          Math.max(1, Math.round(h * scale))
        );
      }

      ctx.fillStyle = "#22d3ee";
      r(stride,       0,  12, 6);
      r(16 - stride,  0,  12, 6);
      ctx.fillStyle = "#3d2870";
      r(3 + stride,  -18,  8, 18);
      r(17 - stride, -18,  8, 18);
      ctx.fillStyle = "#1e1040"; r(-2, -44, 34, 28);
      ctx.fillStyle = "#5a3fa0"; r( 1, -41, 28, 22);
      ctx.fillStyle = core;      r(12, -34,  8,  8);
      const arm = Math.round(Math.sin(t * 0.0085 + Math.PI) * 5 * scale);
      ctx.fillStyle = "#3d2870";
      r(-10, -42 + arm/scale,  9, 18);
      r( 31, -42 - arm/scale,  9, 18);
      ctx.fillStyle = "#c4b5fd"; r(38, -30 - arm/scale, 10, 3);
      ctx.fillStyle = "#1a0a30"; r( 3, -64, 24, 20);
      ctx.fillStyle = "#5a3fa0"; r( 6, -61, 18, 15);
      ctx.fillStyle = "#22d3ee";
      r( 8, -57,  5,  4);
      r(17, -57,  5,  4);
      ctx.fillStyle = "#a78bfa"; r(14, -72,  2, 10);
      ctx.fillStyle = "#22d3ee"; r(12, -75,  6,  5);
      ctx.restore();
    }

    // Laser fires RIGHT from gun barrel tip, only when laserAge is active
    function drawVoidLaser(t, laserAge) {
      if (laserAge < 0 || laserAge > LASER_DURATION) return;
      const GROUND = GROUND_FRAC * H;
      const scale = H / 380;
      const px = Math.round(runnerX() + 48 * scale);
      const py = Math.round(GROUND - 30 * scale);
      const laserLen = W - px - 4; // reach to right edge

      const progress = laserAge / LASER_DURATION;
      const alpha = 1 - progress;

      ctx.save(); ctx.lineCap = "round";
      ctx.strokeStyle = LASER_COLOR; ctx.lineWidth = 5 * scale;
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + laserLen, py); ctx.stroke();
      ctx.lineWidth = 2.5 * scale; ctx.globalAlpha = alpha * 0.85;
      ctx.shadowColor = LASER_COLOR; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + laserLen, py); ctx.stroke();
      ctx.fillStyle = LASER_COLOR; ctx.globalAlpha = alpha;
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(px, py, 3 * scale, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    function drawHUD(t) {
      ctx.save(); ctx.globalAlpha = 0.42;
      const score = Math.floor(elapsed * 0.048) % 99999;
      ctx.font = `${Math.round(H * 0.028)}px monospace`;
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`SCORE ${String(score).padStart(6, "0")}`, W * 0.032, H * 0.09);
      ctx.fillStyle = "#a78bfa";
      ctx.fillText("LIVES ♥ ♥ ♥", W * 0.032, H * 0.115);
      ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.35;
      const m = W * 0.032, bl = W * 0.055;
      ctx.beginPath();
      ctx.moveTo(m, m + bl); ctx.lineTo(m, m); ctx.lineTo(m + bl, m); ctx.stroke();
      const bm = W * 0.032, bbl = W * 0.055;
      ctx.beginPath();
      ctx.moveTo(W - bm, H - bm - bbl); ctx.lineTo(W - bm, H - bm); ctx.lineTo(W - bm - bbl, H - bm); ctx.stroke();
      ctx.restore();
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = rect.width || window.innerWidth / 2;
      H = rect.height || window.innerHeight;
      canvas.width  = Math.ceil(W);
      canvas.height = Math.ceil(H);
      resetStars(); resetDunes();
    }

    function tick(ts) {
      const dt = Math.min(ts - (tick._last || ts), 50);
      tick._last = ts;
      elapsed += dt;
      distance += dt * 0.26;

      laserTimer -= dt;
      if (laserTimer < -LASER_DURATION) laserTimer = LASER_INTERVAL;
      const laserAge = laserTimer < 0 ? -laserTimer : -1;

      ctx.clearRect(0, 0, W, H);
      drawBackground();
      drawVoidLaser(elapsed, laserAge);
      drawRunner(elapsed);
      drawHUD(elapsed);

      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement);
    resize();
    raf = requestAnimationFrame(tick);
  })();

})();
