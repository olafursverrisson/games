const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const musicButton = document.getElementById("toggleMusic");

const GAME_TO = 5;
const FLOOR_Y = canvas.height - 78;
const BASE_GRAVITY = 1700;

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
let roundMessage = "Hold key to jump and raise hands";
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
  hoopY: 245,
  playerScale: 1,
  handScale: 1,
  round: 1,
};

const hoops = {
  left: { x: 96 },
  right: { x: canvas.width - 96 },
};

let lastTime = performance.now();
let musicCtx;
let musicNodes = [];
let beatTimer = 0;

function makePlayer(name, color, x, dir, key, team) {
  return {
    name,
    color,
    x,
    y: FLOOR_Y,
    vy: 0,
    width: 58,
    height: 106,
    handSize: 17,
    wobble: Math.random() * Math.PI * 2,
    dir,
    key,
    team,
    holding: false,
    wantHold: false,
    jumpCooldown: 0,
  };
}

function applyRandomRoundSettings() {
  world.gravity = BASE_GRAVITY * randomRange(0.85, 1.2);
  world.hoopRadius = randomRange(45, 75);
  world.playerScale = randomRange(0.82, 1.25);
  world.handScale = randomRange(0.8, 1.5);

  for (const p of players) {
    p.width = 58 * world.playerScale;
    p.height = 106 * world.playerScale;
    p.handSize = 17 * world.handScale;
    p.y = FLOOR_Y;
    p.vy = 0;
    p.holding = false;
    p.wantHold = false;
  }

  ball.owner = null;
  ball.x = canvas.width / 2 + randomRange(-90, 90);
  ball.y = 140;
  ball.vx = randomRange(-120, 120);
  ball.vy = randomRange(-30, 100);

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
  for (const p of players) {
    const onGround = p.y >= FLOOR_Y - 0.5;
    p.wobble += dt * 8;
    p.jumpCooldown = Math.max(0, p.jumpCooldown - dt);

    if (p.wantHold) {
      if (onGround && p.jumpCooldown <= 0) {
        p.vy = -780;
        p.jumpCooldown = 0.32;
        playGrunt();
      }
      p.x += p.dir * 165 * dt;
    }

    p.x += Math.sin(p.wobble) * 24 * dt;

    p.vy += world.gravity * dt;
    p.y += p.vy * dt;

    if (p.y > FLOOR_Y) {
      p.y = FLOOR_Y;
      p.vy = 0;
    }

    p.x = clamp(p.x, 60, canvas.width - 60);

    if (p.holding && !p.wantHold) {
      p.holding = false;
      ball.owner = null;
      ball.vx = p.dir * 260;
      ball.vy = -180;
    }
  }

  if (ball.owner) {
    const p = ball.owner;
    const hand = getHandPosition(p);
    ball.x = hand.x + p.dir * 12;
    ball.y = hand.y - 8;
    ball.vx = p.dir * 145;
    ball.vy = p.vy * 0.4;
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

  beatTimer += dt;
  if (musicCtx && beatTimer > 0.42) {
    beatTimer = 0;
    playBeat();
  }
}

function handlePossession() {
  for (const p of players) {
    if (!p.wantHold) {
      continue;
    }
    const hand = getHandPosition(p);
    const dist = Math.hypot(ball.x - hand.x, ball.y - hand.y);
    if (dist < ball.r + p.handSize) {
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
      }
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
  const inHoop = Math.abs(dx) < world.hoopRadius * 0.52 && Math.abs(dy) < 18;
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
  const lift = player.wantHold ? player.height * 0.72 : player.height * 0.48;
  const wobble = Math.sin(player.wobble * 1.3) * 8;
  return {
    x: player.x + player.dir * (player.width * 0.34 + wobble),
    y: player.y - lift,
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawCourt();
  drawHoop(hoops.left.x);
  drawHoop(hoops.right.x);

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

function drawHoop(x) {
  ctx.strokeStyle = "#f94144";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, world.hoopY - 130);
  ctx.lineTo(x, world.hoopY + 8);
  ctx.stroke();

  ctx.strokeStyle = "#f8961e";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(x, world.hoopY, world.hoopRadius * 0.52, 0.15, Math.PI - 0.15);
  ctx.stroke();

  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * world.hoopRadius * 0.2, world.hoopY + 4);
    ctx.lineTo(x + i * world.hoopRadius * 0.15, world.hoopY + 40);
    ctx.stroke();
  }
}

function drawPlayer(p) {
  const bodyTop = p.y - p.height;
  const wob = Math.sin(p.wobble) * 5;

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.roundRect(p.x - p.width / 2, bodyTop, p.width, p.height, 20);
  ctx.fill();

  ctx.fillStyle = "#f4d3b2";
  ctx.beginPath();
  ctx.arc(p.x + wob, bodyTop - 18, p.width * 0.32, 0, Math.PI * 2);
  ctx.fill();

  const hand = getHandPosition(p);
  ctx.fillStyle = "#ffd6a5";
  ctx.beginPath();
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
  ctx.fillRect(canvas.width / 2 - 200, 18, 400, 98);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(`${score[0]} : ${score[1]}`, canvas.width / 2, 62);

  ctx.font = "20px sans-serif";
  ctx.fillText(roundMessage, canvas.width / 2, 94);
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
  if (!musicCtx) {
    return;
  }
  const now = musicCtx.currentTime;
  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(randomRange(120, 220), now);
  osc.frequency.exponentialRampToValueAtTime(randomRange(70, 110), now + 0.1);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain).connect(musicCtx.destination);
  osc.start(now);
  osc.stop(now + 0.17);
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

function playBeat() {
  if (!musicCtx || musicCtx.state !== "running") {
    return;
  }
  const now = musicCtx.currentTime;
  const note = [220, 247, 262, 294][Math.floor(Math.random() * 4)];

  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(note, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  osc.connect(gain).connect(musicCtx.destination);
  osc.start(now);
  osc.stop(now + 0.36);

  musicNodes.push(osc, gain);
  if (musicNodes.length > 50) {
    musicNodes.splice(0, 10);
  }
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
