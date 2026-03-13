const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const musicButton = document.getElementById("toggleMusic");

const GAME_TO = 5;
const FLOOR_Y = canvas.height - 78;
const BASE_GRAVITY = 1700;
const SWAY_FREQ_HZ = 1;
const SWAY_AMPLITUDE = (35 * Math.PI) / 180; // 70° total swing

const keyMap = {
  w: 0,
  e: 1,
  i: 2,
  o: 3,
};

const players = [
  makePlayer("R1", "#f94144", 160, -1, "w", 0),
  makePlayer("R2", "#f3722c", 300, -1, "e", 0),
  makePlayer("B1", "#577bff", 900, 1, "i", 1),
  makePlayer("B2", "#43aa8b", 1040, 1, "o", 1),
];

const score = [0, 0];
let roundMessage = "Time your jump with sway to leap forward/back";
let roundMessageTime = 2;

const ball = {
  x: canvas.width / 2,
  y: 120,
  vx: 50,
  vy: 0,
  r: 18,
  owner: null,
};

const world = {
  gravity: BASE_GRAVITY,
  hoopRadius: 58,
  hoopY: 250,
  playerScale: 1,
  handScale: 1,
  round: 1,
  time: 0,
};

const hoops = {
  left: { x: 130, facing: 1 },
  right: { x: canvas.width - 130, facing: -1 },
};

let lastTime = performance.now();
let musicCtx;
let beatStep = 0;
let beatTimer = 0;
const beatInterval = 60 / 124 / 2;

function makePlayer(name, color, x, dir, key, team) {
  return {
    name,
    color,
    x,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    width: 58,
    height: 106,
    handSize: 17,
    dir,
    key,
    team,
    holding: false,
    wantHold: false,
    jumpCooldown: 0,
    swayPhase: Math.random() * Math.PI * 2,
    angle: 0,
    tumble: 0,
    tumbleSpin: 0,
  };
}

function applyRandomRoundSettings() {
  world.gravity = BASE_GRAVITY * randomRange(0.85, 1.2);
  world.hoopRadius = randomRange(44, 76);
  world.playerScale = randomRange(0.82, 1.25);
  world.handScale = randomRange(0.8, 1.5);

  for (const p of players) {
    p.width = 58 * world.playerScale;
    p.height = 106 * world.playerScale;
    p.handSize = 17 * world.handScale;
    p.y = FLOOR_Y;
    p.vx = 0;
    p.vy = 0;
    p.holding = false;
    p.wantHold = false;
    p.tumble = 0;
    p.tumbleSpin = 0;
  }

  ball.owner = null;
  ball.x = canvas.width / 2;
  ball.y = FLOOR_Y - 180;
  ball.vx = randomRange(-40, 40);
  ball.vy = -40;

  roundMessage = `Round ${world.round}: hoop ${world.hoopRadius < 58 ? "small" : "big"}, players ${world.playerScale > 1 ? "chunky" : "tiny"}, hands ${world.handScale > 1 ? "huge" : "small"}`;
  roundMessageTime = 4;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function update(dt) {
  world.time += dt;

  for (const p of players) {
    const onGround = p.y >= FLOOR_Y - 0.5;
    p.jumpCooldown = Math.max(0, p.jumpCooldown - dt);

    const sway = Math.sin((world.time + p.swayPhase) * Math.PI * 2 * SWAY_FREQ_HZ);
    p.angle = sway * SWAY_AMPLITUDE;

    if (p.wantHold && onGround && p.jumpCooldown <= 0 && p.tumble <= 0) {
      p.vy = -760;
      p.jumpCooldown = 0.28;
      p.vx += Math.sin(p.angle) * 420;
      p.vx += p.dir * 60;
      playGrunt();
    }

    if (p.wantHold) {
      p.vx += p.dir * 190 * dt;
    }

    p.vx *= onGround ? 0.9 : 0.995;
    p.vx = clamp(p.vx, -360, 360);
    p.x += p.vx * dt;

    p.vy += world.gravity * dt;
    p.y += p.vy * dt;

    if (p.y > FLOOR_Y) {
      p.y = FLOOR_Y;
      p.vy = 0;
      if (p.tumble > 0) {
        p.tumble = Math.max(0, p.tumble - dt * 2.6);
      }
    }

    if (p.tumble > 0 && !onGround) {
      p.tumble = Math.max(0, p.tumble - dt * 0.5);
    }

    p.x = clamp(p.x, 60, canvas.width - 60);

    if (p.holding && !p.wantHold) {
      p.holding = false;
      ball.owner = null;
      ball.vx = p.vx + p.dir * 220 + Math.sin(p.angle) * 180;
      ball.vy = p.vy - 150;
    }
  }

  resolvePlayerCollisions();

  if (ball.owner) {
    const p = ball.owner;
    const hand = getHandPosition(p);
    ball.x = hand.x + p.dir * 9;
    ball.y = hand.y - 6;
    ball.vx = p.vx;
    ball.vy = p.vy * 0.35;
  } else {
    ball.vy += world.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx *= -0.86;
    }
    if (ball.x > canvas.width - ball.r) {
      ball.x = canvas.width - ball.r;
      ball.vx *= -0.86;
    }
    if (ball.y > FLOOR_Y - ball.r) {
      ball.y = FLOOR_Y - ball.r;
      ball.vy *= -0.78;
      ball.vx *= 0.98;
    }
  }

  handlePossession();
  checkScore();

  if (roundMessageTime > 0) {
    roundMessageTime -= dt;
  }

  if (musicCtx && musicCtx.state === "running") {
    beatTimer += dt;
    while (beatTimer > beatInterval) {
      beatTimer -= beatInterval;
      playBeatStep();
    }
  }
}

function resolvePlayerCollisions() {
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i];
      const b = players[j];
      const minDist = (a.width + b.width) * 0.35;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;

      if (dist < minDist && Math.abs(dy) < (a.height + b.height) * 0.55) {
        const nx = dx / dist;
        const overlap = minDist - dist;

        a.x -= nx * overlap * 0.5;
        b.x += nx * overlap * 0.5;

        const relVx = b.vx - a.vx;
        const impulse = relVx * 0.6;
        a.vx += impulse;
        b.vx -= impulse;

        const impact = Math.abs(relVx);
        if (impact > 180 && Math.random() < 0.14) {
          triggerTumble(a, nx * -1);
        }
        if (impact > 180 && Math.random() < 0.14) {
          triggerTumble(b, nx);
        }
      }
    }
  }
}

function triggerTumble(player, dir) {
  if (player.tumble > 0.15) {
    return;
  }
  player.tumble = randomRange(0.6, 1.2);
  player.tumbleSpin = dir * randomRange(3.4, 5.1);
  player.vy = Math.min(player.vy, -220);
}

function handlePossession() {
  for (const p of players) {
    if (p.tumble > 0.25) {
      continue;
    }

    const hand = getHandPosition(p);
    const handDist = Math.hypot(ball.x - hand.x, ball.y - hand.y);

    const bodyCx = p.x + Math.sin(p.angle) * p.height * 0.12;
    const bodyCy = p.y - p.height * 0.52;
    const bodyRx = p.width * 0.48;
    const bodyRy = p.height * 0.6;
    const ex = (ball.x - bodyCx) / bodyRx;
    const ey = (ball.y - bodyCy) / bodyRy;
    const bodyTouch = ex * ex + ey * ey < 1.05;

    const canCatch = handDist < ball.r + p.handSize || bodyTouch;
    if (!canCatch) {
      continue;
    }

    if (!ball.owner || ball.owner !== p) {
      if (ball.owner && ball.owner.team !== p.team) {
        roundMessage = `${p.name} stole it!`;
        roundMessageTime = 1.5;
      }
      if (ball.owner) {
        ball.owner.holding = false;
      }
      ball.owner = p;
      p.holding = true;
      p.wantHold = true;
    }
  }
}

function checkScore() {
  if (isScored(hoops.left.x, 0)) {
    score[1] += 1;
    scoreRound(1);
  } else if (isScored(hoops.right.x, 1)) {
    score[0] += 1;
    scoreRound(0);
  }
}

function isScored(hoopX, defendingTeam) {
  const dx = ball.x - hoopX;
  const dy = ball.y - world.hoopY;
  const inHoop = Math.abs(dx) < world.hoopRadius * 0.42 && Math.abs(dy) < 18;
  const movingDown = ball.vy > 120;
  const fromEnemy = !ball.owner || ball.owner.team !== defendingTeam;
  return inHoop && movingDown && fromEnemy;
}

function scoreRound(teamScored) {
  world.round += 1;
  roundMessage = `${teamScored === 0 ? "Red" : "Blue"} scores! ${score[0]} - ${score[1]}`;
  roundMessageTime = 2;

  if (score[0] >= GAME_TO || score[1] >= GAME_TO) {
    const winner = score[0] > score[1] ? "Red Team" : "Blue Team";
    roundMessage = `${winner} wins ${score[0]} - ${score[1]}! New match!`;
    score[0] = 0;
    score[1] = 0;
    world.round = 1;
  }

  applyRandomRoundSettings();
}

function getHandPosition(player) {
  const lift = player.wantHold ? player.height * 0.78 : player.height * 0.53;
  const bodyLeanX = Math.sin(player.angle) * (player.height * 0.22);
  const wobble = Math.sin((world.time + player.swayPhase) * Math.PI * 2) * 6;
  return {
    x: player.x + bodyLeanX + player.dir * (player.width * 0.52 + wobble),
    y: player.y - lift,
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawCourt();
  drawHoop(hoops.left.x, hoops.left.facing);
  drawHoop(hoops.right.x, hoops.right.facing);
  drawHoop(hoops.left.x, 1);
  drawHoop(hoops.right.x, -1);

  for (const p of players) {
    drawPlayer(p);
  }
  drawBall();
  drawScore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#8ed2ff");
  sky.addColorStop(1, "#6ab4ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff66";
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.ellipse(140 + i * 200, 120 + (i % 2) * 40, 80, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCourt() {
  ctx.fillStyle = "#ddb36c";
  ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);

  ctx.strokeStyle = "#ffffffcc";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, FLOOR_Y);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
}

function drawHoop(x, facing) {
  const boardW = 18;
  const boardH = 125;
  const boardX = x + facing * 28;

  ctx.fillStyle = "#ffffffee";
  ctx.fillRect(boardX - boardW / 2, world.hoopY - boardH, boardW, boardH);
  ctx.strokeStyle = "#b3b3b3";
  ctx.lineWidth = 2;
  ctx.strokeRect(boardX - boardW / 2, world.hoopY - boardH, boardW, boardH);

  const rimX = x;
  const rimY = world.hoopY;
  const rimW = world.hoopRadius * 0.95;
  const rimH = world.hoopRadius * 0.28;

  ctx.strokeStyle = "#ef6c00";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(rimX, rimY, rimW * 0.5, rimH * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#ffffffbb";
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(rimX + i * (rimW * 0.08), rimY + 4);
    ctx.bezierCurveTo(
      rimX + i * (rimW * 0.09),
      rimY + 18,
      rimX + i * (rimW * 0.06),
      rimY + 34,
      rimX + i * (rimW * 0.03),
      rimY + 44
    );
    ctx.stroke();
  }
}

function drawPlayer(p) {
  const bodyTop = p.y - p.height;
  const lean = p.angle * 0.8 + p.tumbleSpin * p.tumble;

  ctx.save();
  ctx.translate(p.x, p.y - p.height * 0.5);
  ctx.rotate(lean);

  // high socks
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(-p.width * 0.28, p.height * 0.32, p.width * 0.18, p.height * 0.22);
  ctx.fillRect(p.width * 0.1, p.height * 0.32, p.width * 0.18, p.height * 0.22);

  // shorts + jersey
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-p.width * 0.34, p.height * 0.08, p.width * 0.68, p.height * 0.22);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.roundRect(-p.width / 2, -p.height / 2, p.width, p.height * 0.72, 18);
  ctx.fill();

  // arms (longer)
  ctx.strokeStyle = "#f1c7a3";
  ctx.lineWidth = Math.max(5, p.width * 0.11);
  ctx.lineCap = "round";
  const armY = -p.height * 0.18;
  const armReach = p.width * 0.78;
  const armLift = p.wantHold ? -p.height * 0.32 : -p.height * 0.12;
  ctx.beginPath();
  ctx.moveTo(-p.width * 0.18, armY);
  ctx.lineTo(-armReach, armY + armLift);
  ctx.moveTo(p.width * 0.18, armY);
  ctx.lineTo(armReach, armY + armLift);
  ctx.stroke();

  // head
  ctx.fillStyle = "#f4d3b2";
  ctx.beginPath();
  ctx.arc(0, -p.height * 0.62, p.width * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // 70s afro
  ctx.fillStyle = "#1d120a";
  ctx.beginPath();
  ctx.arc(0, -p.height * 0.72, p.width * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4d3b2";
  ctx.beginPath();
  ctx.arc(0, -p.height * 0.62, p.width * 0.26, 0, Math.PI * 2);
  ctx.fill();

  // sweatband
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(3, p.width * 0.08);
  ctx.beginPath();
  ctx.arc(0, -p.height * 0.64, p.width * 0.23, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.roundRect(-p.width / 2, -p.height / 2, p.width, p.height, 20);
  ctx.fill();

  ctx.fillStyle = "#f4d3b2";
  ctx.beginPath();
  ctx.arc(0, -p.height / 2 - 20, p.width * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const hand = getHandPosition(p);
  ctx.fillStyle = "#ffd6a5";
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, p.handSize * 1.05, 0, Math.PI * 2);
  ctx.arc(hand.x, hand.y, p.handSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(p.name, p.x - 14, p.y + 24);
}

function drawBall() {
  ctx.fillStyle = "#f77f00";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5a2d0c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ball.x - ball.r, ball.y);
  ctx.lineTo(ball.x + ball.r, ball.y);
  ctx.moveTo(ball.x, ball.y - ball.r);
  ctx.lineTo(ball.x, ball.y + ball.r);
  ctx.stroke();
}

function drawScore() {
  ctx.fillStyle = "#00000088";
  ctx.fillRect(canvas.width / 2 - 260, 18, 520, 104);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(`${score[0]} : ${score[1]}`, canvas.width / 2, 62);

  ctx.font = "20px sans-serif";
  ctx.fillText(roundMessage, canvas.width / 2, 95);
  ctx.textAlign = "start";
}

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.033);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function playGrunt() {
  if (!musicCtx || musicCtx.state !== "running") {
    return;
  }

  const now = musicCtx.currentTime;
  const dur = randomRange(0.14, 0.23);

  const noiseBuffer = musicCtx.createBuffer(1, Math.floor(musicCtx.sampleRate * dur), musicCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.6;
  }

  const noise = musicCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = musicCtx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = randomRange(420, 720);
  noiseFilter.Q.value = 1.3;

  const voice = musicCtx.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(randomRange(120, 160), now);
  voice.frequency.exponentialRampToValueAtTime(randomRange(88, 110), now + dur);

  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  noise.connect(noiseFilter).connect(gain).connect(musicCtx.destination);
  voice.connect(gain);

  noise.start(now);
  voice.start(now);
  noise.stop(now + dur);
  voice.stop(now + dur);
}

function toggleMusic() {
  if (!musicCtx) {
    musicCtx = new AudioContext();
    musicButton.textContent = "Mute Music";
    return;
  }
  if (musicCtx.state === "running") {
    musicCtx.suspend();
    musicButton.textContent = "Resume Music";
  } else {
    musicCtx.resume();
    musicButton.textContent = "Mute Music";
  }
}

function playBeatStep() {
  if (!musicCtx || musicCtx.state !== "running") {
    return;
  }

  const now = musicCtx.currentTime;
  const stepInBar = beatStep % 8;

  // Kick
  if (stepInBar === 0 || stepInBar === 4 || (stepInBar === 6 && Math.random() < 0.4)) {
    const osc = musicCtx.createOscillator();
    const gain = musicCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain).connect(musicCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Snare / clap
  if (stepInBar === 2 || stepInBar === 6) {
    const dur = 0.09;
    const buffer = musicCtx.createBuffer(1, Math.floor(musicCtx.sampleRate * dur), musicCtx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) {
      d[i] = Math.random() * 2 - 1;
    }
    const src = musicCtx.createBufferSource();
    src.buffer = buffer;
    const hp = musicCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1100;
    const g = musicCtx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(hp).connect(g).connect(musicCtx.destination);
    src.start(now);
    src.stop(now + dur);
  }

  // Hi-hat
  {
    const hatDur = 0.04;
    const b = musicCtx.createBuffer(1, Math.floor(musicCtx.sampleRate * hatDur), musicCtx.sampleRate);
    const hd = b.getChannelData(0);
    for (let i = 0; i < hd.length; i += 1) {
      hd[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const hs = musicCtx.createBufferSource();
    hs.buffer = b;
    const hp = musicCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4500;
    const hg = musicCtx.createGain();
    hg.gain.setValueAtTime(stepInBar % 2 === 0 ? 0.03 : 0.02, now);
    hg.gain.exponentialRampToValueAtTime(0.0001, now + hatDur);
    hs.connect(hp).connect(hg).connect(musicCtx.destination);
    hs.start(now);
    hs.stop(now + hatDur);
  }

  // Bass line
  const bassNotes = [55, 55, 73.4, 65.4, 49, 55, 73.4, 82.4];
  const bass = musicCtx.createOscillator();
  const bassGain = musicCtx.createGain();
  bass.type = "triangle";
  bass.frequency.setValueAtTime(bassNotes[stepInBar], now);
  bassGain.gain.setValueAtTime(0.0001, now);
  bassGain.gain.linearRampToValueAtTime(0.045, now + 0.02);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, now + beatInterval * 0.9);
  bass.connect(bassGain).connect(musicCtx.destination);
  bass.start(now);
  bass.stop(now + beatInterval * 0.95);

  beatStep += 1;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key in keyMap) {
    players[keyMap[key]].wantHold = true;
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key in keyMap) {
    players[keyMap[key]].wantHold = false;
  }
});

musicButton.addEventListener("click", toggleMusic);

applyRandomRoundSettings();
requestAnimationFrame(loop);
