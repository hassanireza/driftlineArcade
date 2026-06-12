(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width;
  const H = canvas.height;
  const GROUND = 286;
  const GRAVITY = 0.62;
  const FAST_FALL = 1.34;
  const JUMP = -12.4;
  const MAX_LIVES = 5;
  const PLAYER_X = 96;
  const LASER_COLOR = "#22d3ee";

  const storageKeys = {
    best: "voidrunner.best.v2",
    board: "voidrunner.leaderboard.v2",
    runs: "voidrunner.runs.v2"
  };

  const els = {
    score: document.getElementById("hudScore"),
    best: document.getElementById("hudBest"),
    lives: document.getElementById("hudLives"),
    ammo: document.getElementById("hudAmmo"),
    heroBest: document.getElementById("heroBest"),
    heroRuns: document.getElementById("heroRuns"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayScore: document.getElementById("overlayScore"),
    overlaySub: document.getElementById("overlaySub"),
    primaryButton: document.getElementById("primaryButton"),
    resumeButton: document.getElementById("resumeButton"),
    pauseButton: document.getElementById("pauseButton"),
    jumpButton: document.getElementById("jumpButton"),
    slideButton: document.getElementById("slideButton"),
    fireButton: document.getElementById("fireButton"),
    board: document.getElementById("leaderboardRows"),
    clearBoard: document.getElementById("clearBoardButton")
  };

  const emptyStats = { best: 0, runs: 0, board: [] };
  let stats = loadStats();
  let state = "ready";
  let raf = 0;
  let lastTime = 0;
  let score = 0;
  let distance = 0;
  let speed = 3.4;
  let spawnTimer = 0;
  let pickupTimer = 0;
  let invincible = 0;
  let shake = 0;
  let flash = 0;
  let deathTime = 0;
  let shotCooldown = 0;
  let stars = [];
  let dunes = [];
  let obstacles = [];
  let pickups = [];
  let lasers = [];
  let enemyShots = [];
  let particles = [];
  let keys = Object.create(null);
  let player = createPlayer();

  function createPlayer() {
    return {
      x: PLAYER_X,
      y: GROUND,
      vy: 0,
      onGround: true,
      jumps: 0,
      sliding: false,
      fastFall: false,
      lives: 3,
      runT: 0,
      glowT: 0
    };
  }

  function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadStats() {
    let board = [];
    try {
      const parsed = JSON.parse(storageGet(storageKeys.board, "[]"));
      if (Array.isArray(parsed)) {
        board = parsed
          .map(item => ({
            score: safeNumber(item.score, 0),
            date: typeof item.date === "string" ? item.date : new Date().toISOString()
          }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
      }
    } catch (error) {
      board = [];
    }

    return {
      best: Math.max(safeNumber(storageGet(storageKeys.best, "0"), 0), board[0] ? board[0].score : 0),
      runs: safeNumber(storageGet(storageKeys.runs, "0"), 0),
      board
    };
  }

  function persistStats() {
    storageSet(storageKeys.best, String(stats.best));
    storageSet(storageKeys.runs, String(stats.runs));
    storageSet(storageKeys.board, JSON.stringify(stats.board));
  }

  function saveRun(finalScore) {
    const cleanScore = Math.max(0, Math.floor(finalScore));
    if (cleanScore <= 0) return;
    stats.runs += 1;
    stats.best = Math.max(stats.best, cleanScore);
    stats.board.push({ score: cleanScore, date: new Date().toISOString() });
    stats.board = stats.board
      .filter(item => item && Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    persistStats();
    renderStats();
  }

  function pad(value) {
    return String(Math.max(0, Math.floor(value))).padStart(5, "0");
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Saved run";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function renderStats() {
    els.best.textContent = pad(stats.best);
    els.heroBest.textContent = pad(stats.best);
    els.heroRuns.textContent = String(stats.runs);
    els.ammo.textContent = "INF";

    if (!stats.board.length) {
      els.board.innerHTML = '<div class="empty-board">Finish a run to save your first score on this device.</div>';
      return;
    }

    els.board.innerHTML = stats.board.map((item, index) => (
      '<div class="leader-row">' +
      '<span class="leader-rank">#' + (index + 1) + '</span>' +
      '<span class="leader-date">' + formatDate(item.date) + '</span>' +
      '<span class="leader-score">' + pad(item.score) + '</span>' +
      '</div>'
    )).join("");
  }

  function setOverlay(mode) {
    els.resumeButton.hidden = true;

    if (mode === "hidden") {
      els.overlay.classList.add("hidden");
      return;
    }

    els.overlay.classList.remove("hidden");

    if (mode === "ready") {
      els.overlayKicker.textContent = "Laser Survival Protocol";
      els.overlayTitle.textContent = "VOIDRUNNER";
      els.overlayScore.textContent = stats.best ? "Best: " + pad(stats.best) : "";
      els.overlaySub.textContent = "Space or Up jumps. Down slides or fast-falls. F or Z fires the infinite laser. P pauses.";
      els.primaryButton.textContent = "Begin Run";
    } else if (mode === "paused") {
      els.overlayKicker.textContent = "Run Paused";
      els.overlayTitle.textContent = "HOLD POSITION";
      els.overlayScore.textContent = "Score: " + pad(score) + "   Best: " + pad(stats.best);
      els.overlaySub.textContent = "Simulation is stopped. Press P, Escape, or Resume to continue.";
      els.primaryButton.textContent = "Restart";
      els.resumeButton.hidden = false;
    } else if (mode === "gameover") {
      els.overlayKicker.textContent = score >= stats.best ? "New Signal Logged" : "Signal Lost";
      els.overlayTitle.textContent = "VEGA DOWN";
      els.overlayScore.textContent = "Score: " + pad(score) + "   Best: " + pad(stats.best);
      els.overlaySub.textContent = "Your completed run has been saved to the local leaderboard.";
      els.primaryButton.textContent = "Run Again";
    }
  }

  function resetWorld() {
    score = 0;
    distance = 0;
    speed = 3.4;
    spawnTimer = 44;
    pickupTimer = 360;
    invincible = 0;
    shake = 0;
    flash = 0;
    deathTime = 0;
    shotCooldown = 0;
    player = createPlayer();
    obstacles = [];
    pickups = [];
    lasers = [];
    enemyShots = [];
    particles = [];
    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: 10 + Math.random() * 120,
      size: Math.random() < 0.76 ? 1 : 2,
      pulse: Math.random() * Math.PI * 2
    }));
    dunes = Array.from({ length: 26 }, (_, i) => ({
      x: i * 54,
      y: GROUND + 8 + Math.random() * 42,
      w: 14 + Math.random() * 44,
      h: 2 + Math.random() * 8
    }));
    updateHud();
  }

  function startRun() {
    resetWorld();
    state = "running";
    lastTime = performance.now();
    setOverlay("hidden");
  }

  function pauseRun() {
    if (state !== "running") return;
    state = "paused";
    setOverlay("paused");
    updateHud();
  }

  function resumeRun() {
    if (state !== "paused") return;
    state = "running";
    lastTime = performance.now();
    setOverlay("hidden");
  }

  function togglePause() {
    if (state === "running") pauseRun();
    else if (state === "paused") resumeRun();
  }

  function jump() {
    if (state === "ready" || state === "gameover") {
      startRun();
      return;
    }
    if (state !== "running") return;
    if (player.jumps >= 2) return;
    player.vy = player.jumps === 0 ? JUMP : JUMP * 0.86;
    player.onGround = false;
    player.sliding = false;
    player.fastFall = false;
    player.jumps += 1;
    burst(player.x + 12, GROUND, 8, "#a78bfa", 2.4, -2.2);
  }

  function slide(on) {
    if (state !== "running") return;
    if (on) {
      if (!player.onGround) {
        player.fastFall = true;
      } else {
        player.sliding = true;
      }
    } else {
      player.sliding = false;
      player.fastFall = false;
    }
  }

  function fireLaser() {
    if (state !== "running" || shotCooldown > 0) return;
    shotCooldown = 9;
    const box = playerBox();
    const y = player.sliding ? box.y + 7 : box.y + Math.max(10, box.h * 0.38);
    lasers.push({ x: box.x + box.w + 6, y, w: 34, h: 5, vx: 19, life: 1 });
    burst(box.x + box.w + 10, y + 2, 4, LASER_COLOR, 1.4, -0.4);
  }

  function playerBox() {
    if (player.sliding && player.onGround) return { x: player.x - 8, y: GROUND - 21, w: 58, h: 20 };
    if (!player.onGround) return { x: player.x + 2, y: player.y - 45, w: 34, h: 38 };
    return { x: player.x, y: GROUND - 58, w: 30, h: 58 };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, count, color, spread, rise) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: rise - Math.random() * spread,
        size: 2 + Math.random() * 4,
        color,
        life: 1,
        decay: 0.035 + Math.random() * 0.035
      });
    }
  }

  function spawnObstacle() {
    const progress = Math.min(1, score / 2600);
    const roll = Math.random();
    let type = "rock";

    if (roll < 0.24 + progress * 0.08) type = "rock";
    else if (roll < 0.46) type = "crystal";
    else if (roll < 0.72) type = "drone";
    else if (roll < 0.88) type = "gate";
    else type = "turret";

    const base = { type, x: W + 30, alive: true, t: Math.random() * 100, hp: 1 };

    if (type === "rock") {
      base.w = 30 + Math.random() * 34;
      base.h = 28 + Math.random() * 34;
      base.y = GROUND;
      base.solid = true;
    } else if (type === "crystal") {
      base.w = 42;
      base.h = 56 + Math.random() * 28;
      base.y = GROUND;
      base.solid = true;
    } else if (type === "drone") {
      base.w = 48;
      base.h = 22;
      base.y = GROUND - 98 - Math.random() * 34;
      base.hp = 2;
      base.shoot = 100 + Math.random() * 70;
      base.solid = true;
    } else if (type === "gate") {
      base.w = 58;
      base.h = 26;
      base.y = GROUND - 64;
      base.hp = 1;
      base.solid = true;
    } else {
      base.w = 34;
      base.h = 42;
      base.y = GROUND;
      base.hp = 3;
      base.shoot = 80 + Math.random() * 60;
      base.solid = true;
    }

    obstacles.push(base);
  }

  function spawnPickup() {
    const type = Math.random() < 0.58 ? "life" : "shield";
    pickups.push({
      type,
      x: W + 24,
      y: GROUND - 86 - Math.random() * 72,
      w: 24,
      h: 24,
      t: Math.random() * 20,
      alive: true
    });
  }

  function obstacleBox(o) {
    if (o.type === "rock") return { x: o.x + 4, y: GROUND - o.h + 4, w: o.w - 8, h: o.h - 4 };
    if (o.type === "crystal") return { x: o.x + 4, y: GROUND - o.h + 6, w: o.w - 8, h: o.h - 6 };
    if (o.type === "drone") return { x: o.x + 5, y: o.y + Math.sin(o.t) * 5 + 3, w: o.w - 10, h: o.h - 4 };
    if (o.type === "gate") return { x: o.x + 2, y: o.y, w: o.w - 4, h: o.h };
    return { x: o.x + 4, y: GROUND - o.h + 4, w: o.w - 8, h: o.h - 4 };
  }

  function damagePlayer() {
    if (invincible > 0 || state !== "running") return;
    player.lives -= 1;
    invincible = 96;
    shake = 16;
    flash = 12;
    const box = playerBox();
    burst(box.x + box.w / 2, box.y + box.h / 2, 24, "#ff4d5f", 5.6, -2);
    if (player.lives <= 0) {
      player.lives = 0;
      state = "dying";
      deathTime = 0;
      saveRun(score);
    }
    updateHud();
  }

  function update(dt) {
    if (state !== "running" && state !== "dying") return;

    const step = Math.min(dt / 16.6667, 2);
    const active = state === "running";

    if (active) {
      score += step;
      distance += speed * step;
      speed = Math.min(9.6, 3.4 + score * 0.0022);
      spawnTimer -= step;
      pickupTimer -= step;
      shotCooldown = Math.max(0, shotCooldown - step);
      invincible = Math.max(0, invincible - step);

      if (spawnTimer <= 0) {
        spawnObstacle();
        const difficulty = Math.max(48, 132 - score * 0.018);
        spawnTimer = difficulty + Math.random() * 42;
      }

      if (pickupTimer <= 0) {
        spawnPickup();
        pickupTimer = 520 + Math.random() * 300;
      }
    } else {
      deathTime += step;
      speed = Math.max(0, speed - 0.09 * step);
      if (deathTime > 90) {
        state = "gameover";
        setOverlay("gameover");
      }
    }

    if (player.onGround && !player.sliding) player.runT += 0.22 * step;
    player.glowT += 0.08 * step;
    shake = Math.max(0, shake - step);
    flash = Math.max(0, flash - step);

    if (!player.onGround) {
      player.vy += (player.fastFall ? FAST_FALL : GRAVITY) * step;
      player.y += player.vy * step;
      if (player.y >= GROUND) {
        player.y = GROUND;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
        player.fastFall = false;
        burst(player.x + 16, GROUND, 7, "#c1440e", 2, -1);
      }
    }

    for (const o of obstacles) {
      o.x -= speed * step;
      o.t += 0.05 * step;
      if (active && (o.type === "turret" || o.type === "drone")) {
        o.shoot -= step;
        if (o.shoot <= 0) {
          const box = obstacleBox(o);
          enemyShots.push({ x: box.x - 4, y: box.y + box.h * 0.5, w: 14, h: 5, vx: -speed * 1.5 });
          o.shoot = o.type === "turret" ? 95 + Math.random() * 50 : 120 + Math.random() * 80;
        }
      }
    }

    for (const pickup of pickups) {
      pickup.x -= speed * 0.9 * step;
      pickup.t += 0.08 * step;
    }

    for (const laser of lasers) laser.x += laser.vx * step;
    for (const shot of enemyShots) shot.x += shot.vx * step;

    for (const p of particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.12 * step;
      p.life -= p.decay * step;
    }

    obstacles = obstacles.filter(o => o.alive && o.x > -120);
    pickups = pickups.filter(p => p.alive && p.x > -60);
    lasers = lasers.filter(l => l.x < W + 60);
    enemyShots = enemyShots.filter(s => s.x > -40);
    particles = particles.filter(p => p.life > 0);

    if (active) resolveCollisions();
    updateHud();
  }

  function resolveCollisions() {
    const pBox = playerBox();

    for (let li = lasers.length - 1; li >= 0; li -= 1) {
      const laser = lasers[li];
      let spent = false;
      for (const obstacle of obstacles) {
        if (!obstacle.alive) continue;
        const box = obstacleBox(obstacle);
        if (!rectsOverlap(laser, box)) continue;
        obstacle.hp -= 1;
        spent = true;
        burst(laser.x + laser.w, laser.y + 2, 8, LASER_COLOR, 3, -1.2);
        if (obstacle.hp <= 0) {
          obstacle.alive = false;
          score += obstacle.type === "turret" ? 80 : obstacle.type === "drone" ? 60 : 35;
          burst(box.x + box.w / 2, box.y + box.h / 2, 18, "#ff754a", 5, -2);
        }
        break;
      }
      if (spent) lasers.splice(li, 1);
    }

    for (const obstacle of obstacles) {
      if (!obstacle.alive || !obstacle.solid) continue;
      if (rectsOverlap(pBox, obstacleBox(obstacle))) {
        obstacle.alive = false;
        damagePlayer();
        break;
      }
    }

    for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
      if (rectsOverlap(pBox, enemyShots[i])) {
        enemyShots.splice(i, 1);
        damagePlayer();
      }
    }

    for (const pickup of pickups) {
      const y = pickup.y + Math.sin(pickup.t) * 7;
      if (!rectsOverlap(pBox, { x: pickup.x, y, w: pickup.w, h: pickup.h })) continue;
      pickup.alive = false;
      if (pickup.type === "life") {
        player.lives = Math.min(MAX_LIVES, player.lives + 1);
        burst(pickup.x + 12, y + 12, 14, "#61d394", 3.4, -2);
      } else {
        invincible = Math.max(invincible, 150);
        burst(pickup.x + 12, y + 12, 16, "#22d3ee", 3.8, -2);
      }
    }
  }

  function updateHud() {
    els.score.textContent = pad(score);
    els.best.textContent = pad(Math.max(stats.best, score));
    els.lives.textContent = String(player.lives) + " / " + MAX_LIVES;
    els.pauseButton.textContent = state === "paused" ? "Resume" : "Pause";
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.45);
    }

    drawBackground();
    drawPickups();
    drawObstacles();
    drawLasers();
    drawEnemyShots();
    drawPlayer();
    drawParticles();
    drawCanvasHud();

    if (flash > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, " + (flash / 12 * 0.24) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawBackground() {
    ctx.fillStyle = "#07050a";
    ctx.fillRect(0, 0, W, H);

    const skyShift = distance * 0.035;
    for (const star of stars) {
      const x = wrap(star.x - skyShift, W);
      const alpha = 0.35 + Math.sin(star.pulse + distance * 0.018) * 0.24;
      ctx.fillStyle = "rgba(244, 239, 251, " + Math.max(0.18, alpha).toFixed(3) + ")";
      ctx.fillRect(Math.round(x), Math.round(star.y), star.size, star.size);
    }

    drawMoon(760 - distance * 0.018, 62, 30, "#3a1b12", "#1b0d0a");
    drawMoon(438 - distance * 0.012, 40, 14, "#25152f", "#100916");

    drawMountains(distance * 0.15, "#210c08", 112, 8);
    drawMountains(distance * 0.38, "#4a1608", 86, 11);

    ctx.fillStyle = "#5c2010";
    ctx.fillRect(0, GROUND + 5, W, H - GROUND);
    ctx.fillStyle = "#8d3615";
    ctx.fillRect(0, GROUND + 10, W, H - GROUND);
    ctx.fillStyle = "#c1440e";
    ctx.fillRect(0, GROUND, W, 5);
    ctx.fillStyle = "#2d0d07";
    ctx.fillRect(0, GROUND + 5, W, 4);

    for (const dune of dunes) {
      const x = wrap(dune.x - distance * 0.72, W + 80) - 40;
      ctx.fillStyle = "#351009";
      ctx.fillRect(Math.round(x), Math.round(dune.y), dune.w, dune.h);
    }
  }

  function wrap(value, max) {
    return ((value % max) + max) % max;
  }

  function drawMoon(x, y, r, color, shadow) {
    const px = wrap(x, W + r * 4) - r * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(px + r * 0.32, y - r * 0.18, r * 0.68, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains(offset, color, height, peaks) {
    const width = W * 1.8;
    const step = width / peaks;
    const start = -wrap(offset, width);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 1);
    for (let rep = 0; rep < 3; rep += 1) {
      for (let i = 0; i <= peaks; i += 1) {
        const x = start + rep * width + i * step;
        const y = GROUND - height * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + 0.6)));
        ctx.lineTo(x, GROUND);
        ctx.lineTo(x + step * 0.5, y);
        ctx.lineTo(x + step, GROUND);
      }
    }
    ctx.lineTo(W, GROUND + 1);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer() {
    const box = playerBox();
    const blinking = invincible > 0 && Math.floor(invincible / 7) % 2 === 0;
    if (blinking) ctx.globalAlpha = 0.42;

    if (player.sliding && player.onGround) {
      drawSlider(box);
    } else if (!player.onGround) {
      drawJet(box);
    } else {
      drawRunner(box);
    }

    ctx.globalAlpha = 1;
  }

  function drawRunner(box) {
    const x = Math.round(box.x);
    const y = Math.round(GROUND);
    const stride = Math.round(Math.sin(player.runT) * 6);
    const core = Math.sin(player.glowT * 4) > 0 ? "#22d3ee" : "#a78bfa";

    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + stride, y, 12, 6);
    ctx.fillRect(x + 16 - stride, y, 12, 6);

    ctx.fillStyle = "#3d2870";
    ctx.fillRect(x + 3 + stride, y - 18, 8, 18);
    ctx.fillRect(x + 17 - stride, y - 18, 8, 18);

    ctx.fillStyle = "#1e1040";
    ctx.fillRect(x - 2, y - 44, 34, 28);
    ctx.fillStyle = "#5a3fa0";
    ctx.fillRect(x + 1, y - 41, 28, 22);
    ctx.fillStyle = core;
    ctx.fillRect(x + 12, y - 34, 8, 8);

    const arm = Math.round(Math.sin(player.runT + Math.PI) * 5);
    ctx.fillStyle = "#3d2870";
    ctx.fillRect(x - 10, y - 42 + arm, 9, 18);
    ctx.fillRect(x + 31, y - 42 - arm, 9, 18);
    ctx.fillStyle = "#c4b5fd";
    ctx.fillRect(x + 38, y - 30 - arm, 10, 3);

    ctx.fillStyle = "#1a0a30";
    ctx.fillRect(x + 3, y - 64, 24, 20);
    ctx.fillStyle = "#5a3fa0";
    ctx.fillRect(x + 6, y - 61, 18, 15);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 8, y - 57, 5, 4);
    ctx.fillRect(x + 17, y - 57, 5, 4);
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(x + 14, y - 72, 2, 10);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 12, y - 75, 6, 5);
  }

  function drawSlider(box) {
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    ctx.fillStyle = "#11091e";
    ctx.fillRect(x + 4, y + 17, box.w - 8, 5);
    ctx.fillStyle = "#3d2870";
    ctx.fillRect(x, y + 7, box.w, 14);
    ctx.fillStyle = "#5a3fa0";
    ctx.fillRect(x + 12, y + 1, 34, 12);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 16, y + 3, 11, 7);
    ctx.fillStyle = "#c4b5fd";
    ctx.fillRect(x + box.w - 8, y + 10, 8, 3);
    ctx.fillStyle = "#0d0717";
    ctx.fillRect(x + 8, y + 19, 10, 7);
    ctx.fillRect(x + box.w - 19, y + 19, 10, 7);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 10, y + 21, 6, 3);
    ctx.fillRect(x + box.w - 17, y + 21, 6, 3);
  }

  function drawJet(box) {
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    ctx.fillStyle = "#160824";
    ctx.fillRect(x - 4, y + 8, 42, 22);
    ctx.fillStyle = "#3d2870";
    ctx.fillRect(x, y + 11, 38, 16);
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(x + 34, y + 14, 8, 10);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 18, y + 13, 12, 8);
    ctx.fillStyle = "#5a3fa0";
    ctx.fillRect(x + 4, y + 2, 24, 7);
    ctx.fillRect(x + 4, y + 29, 24, 7);
    ctx.fillStyle = "#ff754a";
    ctx.fillRect(x - 12, y + 14, 9, 5);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(x - 8, y + 20, 6, 4);
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === "rock") drawRock(o);
      else if (o.type === "crystal") drawCrystal(o);
      else if (o.type === "drone") drawDrone(o);
      else if (o.type === "gate") drawGate(o);
      else drawTurret(o);
    }
  }

  function drawRock(o) {
    const x = Math.round(o.x);
    const y = Math.round(GROUND - o.h);
    ctx.fillStyle = "#3a1005";
    ctx.fillRect(x - 3, y + 3, o.w + 6, o.h - 2);
    ctx.fillStyle = "#7a2a0a";
    ctx.fillRect(x, y, o.w, o.h);
    ctx.fillStyle = "#c1440e";
    ctx.fillRect(x + 8, y + 8, 12, 5);
    ctx.fillRect(x + o.w - 18, y + o.h - 16, 10, 5);
  }

  function drawCrystal(o) {
    const x = Math.round(o.x);
    const y = Math.round(GROUND);
    ctx.fillStyle = "#063040";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + o.w * 0.5, y - o.h);
    ctx.lineTo(x + o.w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + o.w * 0.5, y - o.h + 9);
    ctx.lineTo(x + o.w - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a5f3fc";
    ctx.fillRect(x + o.w * 0.48, y - o.h + 13, 3, o.h * 0.5);
  }

  function drawDrone(o) {
    const x = Math.round(o.x);
    const y = Math.round(o.y + Math.sin(o.t) * 5);
    ctx.fillStyle = "#4a1606";
    ctx.fillRect(x, y + 4, o.w, o.h - 5);
    ctx.fillStyle = o.hp > 1 ? "#c1440e" : "#ff4d5f";
    ctx.fillRect(x + 4, y, o.w - 8, o.h);
    ctx.fillStyle = "#ffbe7b";
    ctx.fillRect(x + o.w / 2 - 4, y + 8, 8, 6);
    ctx.strokeStyle = "#ff754a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 4);
    ctx.lineTo(x + o.w - 8, y - 4);
    ctx.stroke();
  }

  function drawGate(o) {
    const x = Math.round(o.x);
    const y = Math.round(o.y);
    ctx.fillStyle = "#14003a";
    ctx.fillRect(x, y, o.w, o.h);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, o.w - 4, o.h - 4);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 8, y + 10, o.w - 16, 5);
  }

  function drawTurret(o) {
    const x = Math.round(o.x);
    const y = Math.round(GROUND);
    ctx.fillStyle = "#180824";
    ctx.fillRect(x, y - o.h, o.w, o.h);
    ctx.fillStyle = o.hp > 2 ? "#5a3fa0" : o.hp > 1 ? "#8b3a1a" : "#6a1020";
    ctx.fillRect(x + 3, y - o.h + 3, o.w - 6, o.h - 3);
    ctx.fillStyle = "#ff4d5f";
    ctx.fillRect(x - 9, y - 27, 12, 5);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(x + 9, y - o.h + 9, 8, 5);
  }

  function drawPickups() {
    for (const p of pickups) {
      const x = Math.round(p.x);
      const y = Math.round(p.y + Math.sin(p.t) * 7);
      ctx.fillStyle = "rgba(34, 211, 238, 0.14)";
      ctx.fillRect(x - 4, y - 4, p.w + 8, p.h + 8);
      if (p.type === "life") {
        ctx.fillStyle = "#61d394";
        ctx.fillRect(x + 9, y + 4, 6, 16);
        ctx.fillRect(x + 4, y + 9, 16, 6);
      } else {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, 20, 20);
        ctx.fillStyle = "#a5f3fc";
        ctx.fillRect(x + 7, y + 7, 10, 10);
      }
    }
  }

  function drawLasers() {
    for (const laser of lasers) {
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(Math.round(laser.x), Math.round(laser.y), laser.w, laser.h);
      ctx.fillStyle = "#a5f3fc";
      ctx.fillRect(Math.round(laser.x + 3), Math.round(laser.y + 1), laser.w - 6, 2);
    }
  }

  function drawEnemyShots() {
    for (const shot of enemyShots) {
      ctx.fillStyle = "#ff4d5f";
      ctx.fillRect(Math.round(shot.x), Math.round(shot.y), shot.w, shot.h);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(Math.round(shot.x + 3), Math.round(shot.y + 1), 5, 2);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      const size = Math.max(1, Math.round(p.size * p.life));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawCanvasHud() {
    ctx.fillStyle = "rgba(7, 5, 10, 0.72)";
    ctx.fillRect(0, 0, W, 30);
    ctx.fillStyle = "#a5f3fc";
    ctx.font = "700 16px Consolas, monospace";
    ctx.textBaseline = "top";
    ctx.fillText("SCORE " + pad(score), 12, 7);
    ctx.fillStyle = "#a79ab9";
    ctx.fillText("LASER INF", W - 116, 7);
  }

  function loop(now) {
    const dt = lastTime ? now - lastTime : 16.6667;
    lastTime = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  const gameKeys = new Set(["Space", "ArrowUp", "ArrowDown", "KeyF", "KeyZ", "KeyP", "Escape"]);

  document.addEventListener("keydown", event => {
    if (gameKeys.has(event.code)) event.preventDefault();
    if (keys[event.code]) return;
    keys[event.code] = true;
    if (event.code === "Space" || event.code === "ArrowUp") jump();
    else if (event.code === "ArrowDown") slide(true);
    else if (event.code === "KeyF" || event.code === "KeyZ") fireLaser();
    else if (event.code === "KeyP" || event.code === "Escape") togglePause();
  });

  document.addEventListener("keyup", event => {
    if (gameKeys.has(event.code)) event.preventDefault();
    keys[event.code] = false;
    if (event.code === "ArrowDown") slide(false);
  });

  function pressControl(button, actionDown, actionUp) {
    const down = event => {
      event.preventDefault();
      button.classList.add("active");
      actionDown();
    };
    const up = event => {
      event.preventDefault();
      button.classList.remove("active");
      if (actionUp) actionUp();
    };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", event => {
      if (button.classList.contains("active")) up(event);
    });
  }

  pressControl(els.jumpButton, jump);
  pressControl(els.slideButton, () => slide(true), () => slide(false));
  pressControl(els.fireButton, fireLaser);
  pressControl(els.pauseButton, togglePause);

  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (state === "paused") return;
    jump();
  });

  els.primaryButton.addEventListener("click", startRun);
  els.resumeButton.addEventListener("click", resumeRun);
  els.clearBoard.addEventListener("click", () => {
    stats = { ...emptyStats, board: [] };
    persistStats();
    renderStats();
    updateHud();
    setOverlay(state === "ready" || state === "gameover" ? "ready" : state === "paused" ? "paused" : "hidden");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") pauseRun();
  });

  resetWorld();
  renderStats();
  setOverlay("ready");
  raf = requestAnimationFrame(loop);
})();

