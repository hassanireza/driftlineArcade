(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const scoreValue = document.getElementById("scoreValue");
  const waveValue = document.getElementById("waveValue");
  const healthValue = document.getElementById("healthValue");
  const laserValue = document.getElementById("laserValue");
  const chargeFill = document.getElementById("chargeFill");
  const startOverlay = document.getElementById("startOverlay");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startScores = document.getElementById("startScores");
  const gameOverScores = document.getElementById("gameOverScores");
  const finalScore = document.getElementById("finalScore");
  const finalWave = document.getElementById("finalWave");
  const finalTime = document.getElementById("finalTime");
  const resultCopy = document.getElementById("resultCopy");
  const nameForm = document.getElementById("nameForm");
  const pilotName = document.getElementById("pilotName");

  const STORAGE_KEY = "skyfold-aviary-leaderboard-v1";
  const MAX_SCORES = 10;
  const DPR_LIMIT = 2;
  const PLAYER_RADIUS = 16;
  const LASER_COOLDOWN = 0.16;
  const LASER_RANGE = 780;
  const LASER_DAMAGE = 55;
  const LASER_WIDTH = 6;

  const keys = new Set();
  const touchControls = new Set();
  const pointer = { x: 0, y: 0, active: false };
  const state = createInitialState();
  let mode = "menu";
  let lastFrame = 0;
  let pendingScore = null;
  let scoreSaved = false;

  function createInitialState() {
    return {
      width: 1,
      height: 1,
      score: 0,
      wave: 1,
      health: 100,
      elapsed: 0,
      shake: 0,
      player: { x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2, invulnerable: 0 },
      terraces: [],
      motes: [],
      sentries: [],
      monoliths: [],
      beams: [],
      shards: [],
      spawnTimer: 0,
      monolithTimer: 0,
      laserCooldown: 0,
      waveProgress: 0
    };
  }

  function resetRun() {
    Object.assign(state, createInitialState());
    state.width = canvas.clientWidth || 1;
    state.height = canvas.clientHeight || 1;
    state.player.x = state.width * 0.5;
    state.player.y = state.height * 0.64;
    state.player.invulnerable = 2.2;
    state.spawnTimer = 1;
    state.monolithTimer = 1.4;
    state.terraces = buildTerraces();
    state.motes = Array.from({ length: getMoteCount() }, () => makeMote(true));
    updateHud();
  }

  function buildTerraces() {
    const terraces = [];
    const count = Math.max(9, Math.round(state.height / 88));
    for (let i = 0; i < count; i++) {
      terraces.push({
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        w: Math.random() * 120 + 90,
        h: Math.random() * 38 + 28,
        d: Math.random() * 44 + 28,
        speed: Math.random() * 26 + 18,
        hue: Math.random()
      });
    }
    return terraces;
  }

  function getMoteCount() {
    return Math.min(110, Math.max(42, Math.round(state.width * state.height / 12000)));
  }

  function makeMote(anywhere) {
    return {
      x: Math.random() * state.width,
      y: anywhere ? Math.random() * state.height : -10,
      size: Math.random() * 2.4 + .8,
      speed: Math.random() * 36 + 16,
      color: Math.random() > .5 ? "#fff8eb" : "#f4b29f"
    };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const oldW = state.width || rect.width;
    const oldH = state.height || rect.height;
    state.width = Math.max(1, rect.width);
    state.height = Math.max(1, rect.height);
    state.player.x = clamp(state.player.x || state.width * .5, PLAYER_RADIUS, state.width - PLAYER_RADIUS);
    state.player.y = clamp(state.player.y || state.height * .62, PLAYER_RADIUS, state.height - PLAYER_RADIUS);
    if (Math.abs(oldW - state.width) > 24 || Math.abs(oldH - state.height) > 24) {
      state.terraces = buildTerraces();
      state.motes = Array.from({ length: getMoteCount() }, () => makeMote(true));
    }
  }

  function startRun() {
    resetRun();
    mode = "playing";
    scoreSaved = false;
    pendingScore = null;
    hideAllOverlays();
    lastFrame = performance.now();
    updateHud();
  }

  function pauseRun() {
    if (mode !== "playing") return;
    mode = "paused";
    pauseOverlay.hidden = false;
  }

  function resumeRun() {
    if (mode !== "paused") return;
    mode = "playing";
    pauseOverlay.hidden = true;
    lastFrame = performance.now();
  }

  function endRun(copy) {
    if (mode === "gameover") return;
    mode = "gameover";
    pendingScore = {
      name: sanitizeName(pilotName.value || "Pilot"),
      score: Math.round(state.score),
      wave: state.wave,
      time: Math.floor(state.elapsed),
      date: new Date().toISOString()
    };
    finalScore.textContent = formatNumber(pendingScore.score);
    finalWave.textContent = String(pendingScore.wave);
    finalTime.textContent = formatTime(pendingScore.time);
    resultCopy.textContent = copy || "Your score is ready to save locally.";
    hideAllOverlays();
    gameOverOverlay.hidden = false;
    renderLeaderboards();
    window.setTimeout(() => pilotName.select(), 80);
  }

  function savePendingScore() {
    if (!pendingScore || scoreSaved) return;
    pendingScore.name = sanitizeName(pilotName.value || pendingScore.name || "Pilot");
    const scores = loadScores();
    scores.push(pendingScore);
    scores.sort((a, b) => b.score - a.score || b.wave - a.wave || a.time - b.time);
    saveScores(scores.slice(0, MAX_SCORES));
    scoreSaved = true;
    resultCopy.textContent = "Saved to this browser's leaderboard.";
    renderLeaderboards();
  }

  function hideAllOverlays() {
    startOverlay.hidden = true;
    pauseOverlay.hidden = true;
    gameOverOverlay.hidden = true;
  }

  function showMenu() {
    mode = "menu";
    hideAllOverlays();
    startOverlay.hidden = false;
    renderLeaderboards();
  }

  function loadScores() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && Number.isFinite(item.score))
        .map(item => ({
          name: sanitizeName(item.name || "Pilot"),
          score: Math.max(0, Math.round(item.score)),
          wave: Math.max(1, Math.round(item.wave || 1)),
          time: Math.max(0, Math.round(item.time || 0)),
          date: String(item.date || "")
        }))
        .sort((a, b) => b.score - a.score || b.wave - a.wave || a.time - b.time)
        .slice(0, MAX_SCORES);
    } catch {
      return [];
    }
  }

  function saveScores(scores) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      resultCopy.textContent = "Score could not be saved because local storage is unavailable.";
    }
  }

  function clearScores() {
    localStorage.removeItem(STORAGE_KEY);
    renderLeaderboards();
  }

  function renderLeaderboards() {
    const scores = loadScores();
    renderScoreList(startScores, scores);
    renderScoreList(gameOverScores, scores);
  }

  function renderScoreList(target, scores) {
    target.textContent = "";
    if (!scores.length) {
      const row = document.createElement("li");
      row.className = "empty-row";
      row.textContent = "No scores saved yet.";
      target.append(row);
      return;
    }
    scores.forEach((entry, index) => {
      const row = document.createElement("li");
      row.className = "score-row";
      const rank = document.createElement("span");
      rank.className = "score-rank";
      rank.textContent = `#${index + 1}`;
      const name = document.createElement("b");
      name.textContent = entry.name;
      const score = document.createElement("span");
      score.textContent = `${formatNumber(entry.score)} / L${entry.wave}`;
      row.append(rank, name, score);
      target.append(row);
    });
  }

  function update(dt) {
    state.elapsed += dt;
    state.laserCooldown = Math.max(0, state.laserCooldown - dt);
    state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
    state.shake = Math.max(0, state.shake - dt * 18);
    updateBackground(dt);
    updatePlayer(dt);
    updateSpawning(dt);
    updateSentries(dt);
    updateMonoliths(dt);
    updateEffects(dt);
    handleCollisions();
    updateLayers(dt);
    updateHud();
  }

  function updateBackground(dt) {
    for (const terrace of state.terraces) {
      terrace.y += terrace.speed * dt;
      if (terrace.y - terrace.d > state.height + 70) {
        terrace.x = Math.random() * state.width;
        terrace.y = -90;
        terrace.w = Math.random() * 120 + 90;
        terrace.h = Math.random() * 38 + 28;
        terrace.d = Math.random() * 44 + 28;
      }
    }
    for (const mote of state.motes) {
      mote.y += mote.speed * dt;
      mote.x += Math.sin(state.elapsed + mote.y * .01) * dt * 10;
      if (mote.y > state.height + 12) Object.assign(mote, makeMote(false));
    }
  }

  function updatePlayer(dt) {
    const movement = getMovementInput();
    const acceleration = 830;
    const maxSpeed = 305;
    const drag = Math.pow(.0009, dt);
    state.player.vx = (state.player.vx + movement.x * acceleration * dt) * drag;
    state.player.vy = (state.player.vy + movement.y * acceleration * dt) * drag;
    const speed = Math.hypot(state.player.vx, state.player.vy);
    if (speed > maxSpeed) {
      state.player.vx = state.player.vx / speed * maxSpeed;
      state.player.vy = state.player.vy / speed * maxSpeed;
    }
    state.player.x = clamp(state.player.x + state.player.vx * dt, PLAYER_RADIUS, state.width - PLAYER_RADIUS);
    state.player.y = clamp(state.player.y + state.player.vy * dt, PLAYER_RADIUS, state.height - PLAYER_RADIUS);
    if (pointer.active) {
      state.player.aim = Math.atan2(pointer.y - state.player.y, pointer.x - state.player.x);
    } else if (movement.x || movement.y) {
      state.player.aim = Math.atan2(movement.y, movement.x);
    }
    if (isFiring()) fireLaser();
  }

  function updateSpawning(dt) {
    state.spawnTimer -= dt;
    state.monolithTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnSentry();
      state.spawnTimer = Math.max(.42, 1.08 - state.wave * .055);
    }
    if (state.monolithTimer <= 0) {
      spawnMonolith();
      state.monolithTimer = Math.max(.38, 1.35 - state.wave * .04);
    }
  }

  function updateSentries(dt) {
    for (let i = state.sentries.length - 1; i >= 0; i--) {
      const sentry = state.sentries[i];
      const dx = state.player.x - sentry.x;
      const dy = state.player.y - sentry.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const orbit = Math.sin(state.elapsed * 2.3 + sentry.phase) * sentry.orbit;
      sentry.vx += (dx / distance * sentry.speed + Math.cos(sentry.phase) * orbit - sentry.vx) * Math.min(1, dt * 1.8);
      sentry.vy += (dy / distance * sentry.speed + Math.sin(sentry.phase) * orbit - sentry.vy) * Math.min(1, dt * 1.8);
      sentry.x += sentry.vx * dt;
      sentry.y += sentry.vy * dt;
      sentry.phase += dt;
      if (sentry.health <= 0) destroySentry(i);
    }
  }

  function updateMonoliths(dt) {
    for (let i = state.monoliths.length - 1; i >= 0; i--) {
      const stone = state.monoliths[i];
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      stone.rotation += stone.spin * dt;
      if (stone.y > state.height + 90 || stone.x < -120 || stone.x > state.width + 120) {
        state.monoliths.splice(i, 1);
      }
    }
  }

  function updateEffects(dt) {
    for (let i = state.beams.length - 1; i >= 0; i--) {
      state.beams[i].life -= dt;
      if (state.beams[i].life <= 0) state.beams.splice(i, 1);
    }
    for (let i = state.shards.length - 1; i >= 0; i--) {
      const shard = state.shards[i];
      shard.life -= dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.rotation += shard.spin * dt;
      shard.vx *= Math.pow(.04, dt);
      shard.vy *= Math.pow(.04, dt);
      if (shard.life <= 0) state.shards.splice(i, 1);
    }
  }

  function updateLayers(dt) {
    state.waveProgress += dt;
    if (state.waveProgress >= 22) {
      state.wave += 1;
      state.waveProgress = 0;
      state.score += 250 * state.wave;
      for (let i = 0; i < Math.min(12, 3 + state.wave); i++) spawnSentry();
    }
  }

  function handleCollisions() {
    if (state.player.invulnerable > 0) return;
    for (let i = state.sentries.length - 1; i >= 0; i--) {
      const sentry = state.sentries[i];
      if (circleHit(state.player, PLAYER_RADIUS, sentry, sentry.radius)) {
        damagePlayer(18);
        destroySentry(i, false);
        return;
      }
    }
    for (let i = state.monoliths.length - 1; i >= 0; i--) {
      const stone = state.monoliths[i];
      if (circleHit(state.player, PLAYER_RADIUS, stone, stone.radius)) {
        damagePlayer(12);
        burst(stone.x, stone.y, "#ecc36f", 10);
        state.monoliths.splice(i, 1);
        return;
      }
    }
  }

  function damagePlayer(amount) {
    state.health = Math.max(0, state.health - amount);
    state.player.invulnerable = 1.1;
    state.shake = 8;
    burst(state.player.x, state.player.y, "#e77b69", 18);
    if (state.health <= 0) {
      updateHud();
      endRun("The glider folded into the terraces. Your score is ready to save locally.");
    }
  }

  function fireLaser() {
    if (state.laserCooldown > 0) return;
    state.laserCooldown = LASER_COOLDOWN;
    const sx = state.player.x + Math.cos(state.player.aim) * 19;
    const sy = state.player.y + Math.sin(state.player.aim) * 19;
    const ex = sx + Math.cos(state.player.aim) * LASER_RANGE;
    const ey = sy + Math.sin(state.player.aim) * LASER_RANGE;
    let hitPoint = { x: ex, y: ey };
    let closest = LASER_RANGE;

    for (const sentry of state.sentries) {
      const hit = rayCircle(sx, sy, ex, ey, sentry.x, sentry.y, sentry.radius + LASER_WIDTH);
      if (hit && hit.distance < closest) {
        closest = hit.distance;
        hitPoint = hit.point;
      }
    }
    for (const stone of state.monoliths) {
      const hit = rayCircle(sx, sy, ex, ey, stone.x, stone.y, stone.radius + LASER_WIDTH);
      if (hit && hit.distance < closest) {
        closest = hit.distance;
        hitPoint = hit.point;
      }
    }

    state.beams.push({ sx, sy, ex: hitPoint.x, ey: hitPoint.y, life: .09 });
    state.shake = Math.max(state.shake, 1.6);

    for (let i = state.sentries.length - 1; i >= 0; i--) {
      const sentry = state.sentries[i];
      if (distanceToSegment(sentry.x, sentry.y, sx, sy, hitPoint.x, hitPoint.y) <= sentry.radius + LASER_WIDTH) {
        sentry.health -= LASER_DAMAGE;
        burst(sentry.x, sentry.y, sentry.elite ? "#ecc36f" : "#7cc8be", 6);
        if (sentry.health <= 0) destroySentry(i);
      }
    }

    for (let i = state.monoliths.length - 1; i >= 0; i--) {
      const stone = state.monoliths[i];
      if (distanceToSegment(stone.x, stone.y, sx, sy, hitPoint.x, hitPoint.y) <= stone.radius + LASER_WIDTH) {
        stone.health -= LASER_DAMAGE;
        burst(stone.x, stone.y, "#e7b58f", 5);
        if (stone.health <= 0) {
          state.score += 40;
          state.monoliths.splice(i, 1);
        }
      }
    }
  }

  function spawnSentry() {
    const edge = Math.floor(Math.random() * 4);
    const margin = 52;
    const position = [
      { x: Math.random() * state.width, y: -margin },
      { x: state.width + margin, y: Math.random() * state.height },
      { x: Math.random() * state.width, y: state.height + margin },
      { x: -margin, y: Math.random() * state.height }
    ][edge];
    const elite = Math.random() < Math.min(.32, state.wave * .025);
    const health = elite ? 120 + state.wave * 6 : 70 + state.wave * 4;
    state.sentries.push({
      x: position.x,
      y: position.y,
      vx: 0,
      vy: 0,
      radius: elite ? 19 : 15,
      health,
      maxHealth: health,
      speed: (elite ? 76 : 96) + state.wave * 4,
      orbit: elite ? 38 : 24,
      phase: Math.random() * Math.PI * 2,
      elite
    });
  }

  function spawnMonolith() {
    const radius = Math.random() * 14 + 12;
    state.monoliths.push({
      x: Math.random() * state.width,
      y: -radius - 22,
      vx: (Math.random() - .5) * 70,
      vy: Math.random() * 88 + 86 + state.wave * 4,
      radius,
      health: radius * 3.2,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - .5) * 1.8
    });
  }

  function destroySentry(index, awardScore = true) {
    const sentry = state.sentries[index];
    if (!sentry) return;
    if (awardScore) state.score += sentry.elite ? 180 : 100;
    burst(sentry.x, sentry.y, sentry.elite ? "#ecc36f" : "#7cc8be", sentry.elite ? 18 : 12);
    state.sentries.splice(index, 1);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 50;
      state.shards.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * .35 + .22,
        color,
        size: Math.random() * 5 + 3,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - .5) * 8
      });
    }
  }

  function draw() {
    const shakeX = (Math.random() - .5) * state.shake;
    const shakeY = (Math.random() - .5) * state.shake;
    ctx.save();
    ctx.clearRect(0, 0, state.width, state.height);
    drawSky();
    ctx.translate(shakeX, shakeY);
    drawTerraces();
    drawMotes();
    drawMonoliths();
    drawSentries();
    drawPlayer();
    drawBeams();
    drawShards();
    ctx.restore();
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, "#f6c5b2");
    gradient.addColorStop(.38, "#f4dfbf");
    gradient.addColorStop(.72, "#b8dced");
    gradient.addColorStop(1, "#79b5c6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.globalAlpha = .16;
    ctx.strokeStyle = "#fff8eb";
    ctx.lineWidth = 1;
    const gap = 72;
    const offset = (state.elapsed * 12) % gap;
    for (let y = -gap + offset; y < state.height + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.lineTo(state.width + 40, y - 45);
      ctx.stroke();
    }
    for (let x = -gap; x < state.width + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + state.height * .72, state.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTerraces() {
    for (const terrace of state.terraces) {
      drawIsoBlock(terrace.x, terrace.y, terrace.w, terrace.h, terrace.d, terrace.hue);
    }
  }

  function drawIsoBlock(x, y, w, h, d, hue) {
    const top = hue > .66 ? "#fff4d8" : hue > .33 ? "#eaf0d7" : "#f9eadf";
    const left = hue > .66 ? "#d98aa0" : hue > .33 ? "#97cbbf" : "#e7b58f";
    const right = hue > .66 ? "#6a5d8f" : hue > .33 ? "#6fa9b5" : "#d28e79";
    ctx.save();
    ctx.globalAlpha = .88;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(0, h / 2 + d);
    ctx.lineTo(-w / 2, d);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(0, h / 2 + d);
    ctx.lineTo(w / 2, d);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
    ctx.strokeStyle = "rgba(66, 60, 82, .12)";
    ctx.stroke();
    ctx.restore();
  }

  function drawMotes() {
    ctx.save();
    for (const mote of state.motes) {
      ctx.globalAlpha = .58;
      ctx.fillStyle = mote.color;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim + Math.PI / 2);
    ctx.globalAlpha = p.invulnerable > 0 && Math.floor(p.invulnerable * 14) % 2 ? .48 : 1;
    ctx.shadowColor = "rgba(106, 93, 143, .42)";
    ctx.shadowBlur = 18;

    ctx.fillStyle = "#fff8eb";
    ctx.strokeStyle = "#6a5d8f";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(18, 15);
    ctx.lineTo(4, 9);
    ctx.lineTo(0, 22);
    ctx.lineTo(-4, 9);
    ctx.lineTo(-18, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e77b69";
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 13);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(106, 93, 143, .28)";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 20);
    ctx.moveTo(-15, 12);
    ctx.lineTo(0, 1);
    ctx.lineTo(15, 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawSentries() {
    for (const sentry of state.sentries) {
      ctx.save();
      ctx.translate(sentry.x, sentry.y);
      ctx.rotate(state.elapsed * 1.4 + sentry.phase);
      ctx.shadowColor = sentry.elite ? "rgba(236, 195, 111, .6)" : "rgba(124, 200, 190, .58)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = sentry.elite ? "#ecc36f" : "#7cc8be";
      ctx.strokeStyle = "#fff8eb";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -sentry.radius);
      ctx.lineTo(sentry.radius, 0);
      ctx.lineTo(0, sentry.radius);
      ctx.lineTo(-sentry.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = sentry.elite ? "#6a5d8f" : "#e77b69";
      ctx.beginPath();
      ctx.arc(0, 0, sentry.radius * .34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawHealthBar(sentry.x, sentry.y - sentry.radius - 10, sentry.radius * 2, sentry.health / sentry.maxHealth, sentry.elite ? "#ecc36f" : "#7cc8be");
    }
  }

  function drawMonoliths() {
    for (const stone of state.monoliths) {
      ctx.save();
      ctx.translate(stone.x, stone.y);
      ctx.rotate(stone.rotation);
      drawIsoBlock(0, 0, stone.radius * 2.2, stone.radius * 1.4, stone.radius * 1.8, .42);
      ctx.restore();
    }
  }

  function drawBeams() {
    ctx.save();
    ctx.lineCap = "round";
    for (const beam of state.beams) {
      const alpha = clamp(beam.life / .09, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#fff8eb";
      ctx.lineWidth = 9;
      ctx.shadowColor = "#e77b69";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(beam.sx, beam.sy);
      ctx.lineTo(beam.ex, beam.ey);
      ctx.stroke();
      ctx.strokeStyle = "#e77b69";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(beam.sx, beam.sy);
      ctx.lineTo(beam.ex, beam.ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShards() {
    for (const shard of state.shards) {
      ctx.save();
      ctx.globalAlpha = clamp(shard.life / .55, 0, 1);
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.rotation);
      ctx.fillStyle = shard.color;
      ctx.fillRect(-shard.size / 2, -shard.size / 2, shard.size, shard.size);
      ctx.restore();
    }
  }

  function drawHealthBar(x, y, width, percent, color) {
    ctx.save();
    ctx.fillStyle = "rgba(52, 65, 79, .14)";
    ctx.fillRect(x - width / 2, y, width, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y, width * clamp(percent, 0, 1), 4);
    ctx.restore();
  }

  function getMovementInput() {
    const left = keys.has("arrowleft") || keys.has("a") || touchControls.has("left");
    const right = keys.has("arrowright") || keys.has("d") || touchControls.has("right");
    const up = keys.has("arrowup") || keys.has("w") || touchControls.has("up");
    const down = keys.has("arrowdown") || keys.has("s") || touchControls.has("down");
    let x = Number(right) - Number(left);
    let y = Number(down) - Number(up);
    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  function isFiring() {
    return keys.has(" ") || keys.has("enter") || touchControls.has("fire") || pointer.active;
  }

  function updateHud() {
    scoreValue.textContent = formatNumber(Math.round(state.score));
    waveValue.textContent = String(state.wave);
    healthValue.textContent = `${Math.ceil(state.health)}%`;
    const ready = state.laserCooldown <= 0;
    laserValue.textContent = ready ? "Ready" : "Charge";
    chargeFill.style.transform = `scaleX(${ready ? 1 : clamp(1 - state.laserCooldown / LASER_COOLDOWN, 0, 1)})`;
  }

  function frame(now) {
    resizeCanvas();
    const rawDt = (now - lastFrame) / 1000 || 0;
    const dt = Math.min(rawDt, .05);
    lastFrame = now;
    if (mode === "playing") update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].includes(key)) event.preventDefault();
    if ((key === "p" || key === "escape") && mode === "playing") {
      pauseRun();
      return;
    }
    if ((key === "p" || key === "escape") && mode === "paused") {
      resumeRun();
      return;
    }
    keys.add(key);
    if (mode === "menu" && (key === "enter" || key === " ")) startRun();
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function bindTouchControl(button) {
    const control = button.dataset.control;
    const start = event => {
      event.preventDefault();
      touchControls.add(control);
    };
    const end = event => {
      event.preventDefault();
      touchControls.delete(control);
    };
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("pointerleave", end);
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clamp(event.clientX - rect.left, 0, state.width);
    pointer.y = clamp(event.clientY - rect.top, 0, state.height);
  }

  function sanitizeName(name) {
    return String(name).replace(/[^\w .-]/g, "").trim().slice(0, 18) || "Pilot";
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function circleHit(a, ar, b, br) {
    return Math.hypot(a.x - b.x, a.y - b.y) <= ar + br;
  }

  function distanceToSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const lengthSq = vx * vx + vy * vy;
    if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
    const t = clamp((wx * vx + wy * vy) / lengthSq, 0, 1);
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
  }

  function rayCircle(ax, ay, bx, by, cx, cy, radius) {
    const dx = bx - ax;
    const dy = by - ay;
    const fx = ax - cx;
    const fy = ay - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0 || a === 0) return null;
    const root = Math.sqrt(discriminant);
    const t1 = (-b - root) / (2 * a);
    const t2 = (-b + root) / (2 * a);
    const t = t1 >= 0 && t1 <= 1 ? t1 : (t2 >= 0 && t2 <= 1 ? t2 : null);
    if (t === null) return null;
    const point = { x: ax + dx * t, y: ay + dy * t };
    return { point, distance: Math.hypot(point.x - ax, point.y - ay) };
  }

  document.getElementById("startButton").addEventListener("click", startRun);
  document.getElementById("pauseButton").addEventListener("click", pauseRun);
  document.getElementById("resumeButton").addEventListener("click", resumeRun);
  document.getElementById("restartFromPauseButton").addEventListener("click", startRun);
  document.getElementById("quitButton").addEventListener("click", () => endRun("Run ended. Your score is ready to save locally."));
  document.getElementById("playAgainButton").addEventListener("click", startRun);
  document.getElementById("menuButton").addEventListener("click", showMenu);
  document.getElementById("resetScoresButton").addEventListener("click", clearScores);
  document.getElementById("touchFire").addEventListener("pointerdown", event => {
    event.preventDefault();
    touchControls.add("fire");
  });
  document.getElementById("touchFire").addEventListener("pointerup", event => {
    event.preventDefault();
    touchControls.delete("fire");
  });
  document.getElementById("touchFire").addEventListener("pointercancel", () => touchControls.delete("fire"));
  nameForm.addEventListener("submit", event => {
    event.preventDefault();
    savePendingScore();
  });

  document.querySelectorAll("[data-control]").forEach(bindTouchControl);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    keys.clear();
    touchControls.clear();
    pointer.active = false;
    if (mode === "playing") pauseRun();
  });
  canvas.addEventListener("pointerdown", event => {
    if (mode !== "playing") return;
    pointer.active = true;
    updatePointer(event);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (pointer.active) updatePointer(event);
  });
  canvas.addEventListener("pointerup", event => {
    pointer.active = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    pointer.active = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "playing") pauseRun();
  });

  resizeCanvas();
  resetRun();
  renderLeaderboards();
  requestAnimationFrame(time => {
    lastFrame = time;
    requestAnimationFrame(frame);
  });
})();
