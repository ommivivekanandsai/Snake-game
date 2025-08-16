// Responsive canvas setup
function resizeCanvas() {
  const container = document.getElementById('game-container');
  const canvasSize = Math.min(container.offsetWidth, window.innerHeight * 0.65, 400);
  gameCanvas.width = backgroundCanvas.width = canvasSize;
  gameCanvas.height = backgroundCanvas.height = canvasSize;
}
window.addEventListener('resize', resizeCanvas);

// Game constants
const gameCanvas = document.getElementById('gameCanvas');
const bgCanvas = document.getElementById('backgroundCanvas');
const ctx = gameCanvas.getContext('2d');
const bgCtx = bgCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const restartBtn = document.getElementById('restart');

// Game settings
const GRID_SIZE = 20;
let tileCount = 20; // will be updated on resize
let snake = [];
let direction = { x: 1, y: 0 }; // right
let nextDirection = { x: 1, y: 0 };
let food = {};
let obstacles = [];
let score = 0;
let level = 1;
let speed = 100;
let gameOver = false;
let animationFrame;
let moveTimer = 0;

// Smoother snake movement on bigger screens
let smoothMove = false;
let frameRate = 60;

// Mobile controls
const mobileControls = {
  up: document.getElementById('up'),
  down: document.getElementById('down'),
  left: document.getElementById('left'),
  right: document.getElementById('right')
};

// Enhanced animated gradient background
let bgWaves = [];
const WAVE_COUNT = 8;
function initBackground() {
  bgWaves = [];
  for (let i = 0; i < WAVE_COUNT; i++) {
    bgWaves.push({
      amp: 24 + Math.random() * 30,
      freq: 0.04 + Math.random() * 0.05,
      phase: Math.random() * Math.PI * 2,
      color: `hsla(${120 + Math.random() * 150}, 60%, 28%, 0.23)`
    });
  }
}
function drawBackground(time = 0) {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  const w = bgCanvas.width, h = bgCanvas.height;
  bgWaves.forEach((wave, i) => {
    bgCtx.save();
    bgCtx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      let y = h / 2 +
        Math.sin(wave.freq * x + wave.phase + time * 0.0015 * (i + 1)) *
        wave.amp * Math.sin(time * 0.002 + i);
      if (x === 0) bgCtx.moveTo(x, y);
      else bgCtx.lineTo(x, y);
    }
    bgCtx.lineTo(w, h);
    bgCtx.lineTo(0, h);
    bgCtx.closePath();

    let grad = bgCtx.createLinearGradient(0, h / 2, w, h);
    grad.addColorStop(0, wave.color);
    grad.addColorStop(1, "#181c25");
    bgCtx.fillStyle = grad;
    bgCtx.shadowColor = wave.color;
    bgCtx.shadowBlur = 22 + i * 2;
    bgCtx.globalAlpha = 0.35;
    bgCtx.fill();
    bgCtx.restore();
  });
}

// Snake shape helpers
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Draw snake with cartoon head and tongue
function drawSnake(time = 0) {
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    const next = snake[i - 1] || seg;
    let px = lerp(seg.x, next.x, smoothMove ? moveTimer / speed : 0);
    let py = lerp(seg.y, next.y, smoothMove ? moveTimer / speed : 0);
    if (i === 0) {
      drawSnakeHead(px, py, direction, time);
    } else {
      drawBodySegment(px, py, i);
    }
  }
}

function drawBodySegment(x, y, idx) {
  const size = gameCanvas.width / tileCount;
  ctx.save();
  // Gradient for body
  let grad = ctx.createRadialGradient(
    x * size + size / 2, y * size + size / 2, size / 10,
    x * size + size / 2, y * size + size / 2, size / 2
  );
  grad.addColorStop(0, "#94ff70");
  grad.addColorStop(0.7, "#48c416");
  grad.addColorStop(1, "#2db030");
  ctx.beginPath();
  ctx.arc(
    x * size + size / 2,
    y * size + size / 2,
    size / 2.6,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = grad;
  ctx.shadowColor = "#27d827";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
}

function drawSnakeHead(x, y, dir, time) {
  const size = gameCanvas.width / tileCount;
  ctx.save();

  // Head position
  const centerX = x * size + size / 2;
  const centerY = y * size + size / 2;

  // Head gradient
  let grad = ctx.createRadialGradient(
    centerX, centerY, size / 20,
    centerX, centerY, size / 2
  );
  grad.addColorStop(0, "#f4ffd1");
  grad.addColorStop(0.6, "#7cff1e");
  grad.addColorStop(1, "#48c416");

  // Draw head
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2.1, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = "#12ef12";
  ctx.shadowBlur = 15;
  ctx.fill();

  // Eyes
  let eyeDistance = size / 3.2;
  let eyeY = centerY - size / 5;
  let eyeX1 = centerX - eyeDistance / 2;
  let eyeX2 = centerX + eyeDistance / 2;
  let blink = Math.abs(Math.sin(time * 0.006)) * size / 18 + size / 16;

  // White of eyes
  ctx.beginPath();
  ctx.arc(eyeX1, eyeY, blink, 0, Math.PI * 2);
  ctx.arc(eyeX2, eyeY, blink, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 0;
  ctx.fill();

  // Pupils (look in direction of movement)
  let pupilOffsetX = dir.x * size / 18;
  let pupilOffsetY = dir.y * size / 18;
  ctx.beginPath();
  ctx.arc(eyeX1 + pupilOffsetX, eyeY + pupilOffsetY, blink / 2.2, 0, Math.PI * 2);
  ctx.arc(eyeX2 + pupilOffsetX, eyeY + pupilOffsetY, blink / 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#222";
  ctx.fill();

  // Tongue (forked, protruding from mouth)
  let tongueLength = size / 1.2;
  let tongueWidth = size / 13;
  let mouthY = centerY + size / 2.1;
  let mouthX = centerX;
  // Compute tongue direction
  let tdx = dir.x * tongueLength * 0.6;
  let tdy = dir.y * tongueLength * 0.6;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mouthX, mouthY);
  ctx.lineTo(mouthX + tdx, mouthY + tdy);

  // Forked tongue
  ctx.moveTo(mouthX + tdx, mouthY + tdy);
  ctx.lineTo(mouthX + tdx - tongueWidth, mouthY + tdy + tongueWidth * (dir.x === 0 ? 1 : 0));
  ctx.moveTo(mouthX + tdx, mouthY + tdy);
  ctx.lineTo(mouthX + tdx + tongueWidth, mouthY + tdy + tongueWidth * (dir.x === 0 ? 1 : 0));
  ctx.lineWidth = size / 18;
  ctx.strokeStyle = "#ff2a2a";
  ctx.shadowColor = "#ff2a2a";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// Draw food with glow
function drawFood() {
  const size = gameCanvas.width / tileCount;
  ctx.save();
  let grad = ctx.createRadialGradient(
    food.x * size + size / 2, food.y * size + size / 2, size / 14,
    food.x * size + size / 2, food.y * size + size / 2, size / 2.3
  );
  grad.addColorStop(0, "#ff5656");
  grad.addColorStop(0.5, "#fa2b2b");
  grad.addColorStop(1, "#c41212");
  ctx.beginPath();
  ctx.arc(
    food.x * size + size / 2,
    food.y * size + size / 2,
    size / 2.5,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = grad;
  ctx.shadowColor = "#ff5656";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
}

// Draw obstacles with stone effect
function drawObstacles() {
  const size = gameCanvas.width / tileCount;
  obstacles.forEach(obs => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      obs.x * size + size / 2,
      obs.y * size + size / 2,
      size / 2.5,
      0,
      Math.PI * 2
    );
    let grad = ctx.createRadialGradient(
      obs.x * size + size / 2, obs.y * size + size / 2, size / 10,
      obs.x * size + size / 2, obs.y * size + size / 2, size / 2.6
    );
    grad.addColorStop(0, "#bfc0c2");
    grad.addColorStop(0.7, "#7a7b7e");
    grad.addColorStop(1, "#545456");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#aaa";
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.restore();
  });
}

// Game logic
function placeFood() {
  let valid = false;
  while (!valid) {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
    valid = !snake.some(seg => seg.x === food.x && seg.y === food.y) &&
      !obstacles.some(obs => obs.x === food.x && obs.y === food.y);
  }
}

function placeObstacles() {
  obstacles = [];
  let count = Math.min(level, 20);
  for (let i = 0; i < count; i++) {
    let obs;
    let tries = 0;
    do {
      obs = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
      };
      tries++;
    } while (
      (snake.some(seg => seg.x === obs.x && seg.y === obs.y) ||
      (food.x === obs.x && food.y === obs.y) ||
      obstacles.some(o => o.x === obs.x && o.y === obs.y)) && tries < 50
    );
    obstacles.push(obs);
  }
}

function resetGame() {
  tileCount = Math.floor(gameCanvas.width / GRID_SIZE);
  snake = [{ x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  level = 1;
  speed = 110;
  gameOver = false;
  moveTimer = 0;
  smoothMove = tileCount > 18;
  scoreEl.textContent = "Score: 0";
  levelEl.textContent = "Level: 1";
  restartBtn.style.display = "none";
  placeFood();
  placeObstacles();
  initBackground();
  drawBackground();
  drawGame();
  if (animationFrame) cancelAnimationFrame(animationFrame);
  gameLoop(performance.now());
}

function drawGame(time = 0) {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  drawObstacles();
  drawFood();
  drawSnake(time);
}

function gameLoop(time) {
  if (gameOver) return;
  drawBackground(time);
  drawGame(time);

  moveTimer += 1000 / frameRate;
  if (moveTimer >= speed) {
    moveTimer = 0;
    stepGame();
  }
  animationFrame = requestAnimationFrame(gameLoop);
}

function stepGame() {
  // Update direction (prevents 180 turn)
  if (
    Math.abs(nextDirection.x) !== Math.abs(direction.x) ||
    Math.abs(nextDirection.y) !== Math.abs(direction.y)
  ) {
    direction = { ...nextDirection };
  }
  const head = {
    x: (snake[0].x + direction.x + tileCount) % tileCount,
    y: (snake[0].y + direction.y + tileCount) % tileCount
  };

  // Check collisions
  if (
    snake.some(seg => seg.x === head.x && seg.y === head.y) ||
    obstacles.some(obs => obs.x === head.x && obs.y === head.y)
  ) {
    endGame();
    return;
  }

  snake.unshift(head);

  // Food collision
  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreEl.textContent = `Score: ${score}`;
    // Increase level every 5 points
    if (score % 5 === 0 && level < 100) {
      level++;
      levelEl.textContent = `Level: ${level}`;
      speed = Math.max(30, 110 - Math.floor(level * 0.75));
      placeObstacles();
    }
    placeFood();
  } else {
    snake.pop();
  }
}

function endGame() {
  gameOver = true;
  restartBtn.style.display = "block";
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#181c25";
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.floor(gameCanvas.width / 12)}px Segoe UI, Arial`;
  ctx.textAlign = "center";
  ctx.fillText(
    `Game Over!\nScore: ${score}\nLevel: ${level}`,
    gameCanvas.width / 2,
    gameCanvas.height / 2
  );
  ctx.restore();
}

// Controls
document.addEventListener('keydown', e => {
  if (gameOver) return;
  switch (e.key) {
    case 'ArrowUp':
    case 'w':
      if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
      break;
    case 'ArrowDown':
    case 's':
      if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
      break;
    case 'ArrowLeft':
    case 'a':
      if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
      break;
    case 'ArrowRight':
    case 'd':
      if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
      break;
  }
});

// Mobile controls
Object.entries(mobileControls).forEach(([dir, btn]) => {
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    if (gameOver) return;
    switch (dir) {
      case 'up':
        if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
        break;
      case 'down':
        if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
        break;
      case 'left':
        if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
        break;
      case 'right':
        if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
        break;
    }
  });
  btn.addEventListener('mousedown', e => {
    e.preventDefault();
    if (gameOver) return;
    switch (dir) {
      case 'up':
        if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
        break;
      case 'down':
        if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
        break;
      case 'left':
        if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
        break;
      case 'right':
        if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
        break;
    }
  });
});

// Restart
restartBtn.addEventListener('click', resetGame);

// Responsive init
window.onload = () => {
  resizeCanvas();
  resetGame();
};
window.addEventListener('resize', () => {
  resizeCanvas();
  tileCount = Math.floor(gameCanvas.width / GRID_SIZE);
  resetGame();
});