const canvas = document.getElementById("board");
const context = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");
const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const linesElement = document.getElementById("lines");
const stateElement = document.getElementById("state");
const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const restartButton = document.getElementById("restart");
const touchButtons = document.querySelectorAll(".touch-button");

const COLS = 10;
const ROWS = 20;
const DESKTOP_CELL = 36;
const DESKTOP_NEXT_CELL = 26;
const MOBILE_BREAKPOINT = 768;
const EMPTY = 0;
const BASE_DROP_INTERVAL = 850;
const LINE_CLEAR_EFFECT_DURATION = 580;
const LINE_CLEAR_FLASH_DURATION = 170;
const HARD_DROP_IMPACT_DURATION = 120;
const PARTICLES_PER_CELL = 12;
const MAX_PARTICLES = 250;

const COLORS = [
  null,
  "#6fd6ff",
  "#9ea8ff",
  "#ffd66f",
  "#ff9fbd",
  "#c8a9ff",
  "#ffb184",
  "#7ee8cf",
];

const SHAPES = [
  [[1, 1, 1, 1]],
  [
    [2, 0, 0],
    [2, 2, 2],
  ],
  [
    [0, 0, 3],
    [3, 3, 3],
  ],
  [
    [4, 4],
    [4, 4],
  ],
  [
    [0, 5, 5],
    [5, 5, 0],
  ],
  [
    [0, 6, 0],
    [6, 6, 6],
  ],
  [
    [7, 7, 0],
    [0, 7, 7],
  ],
];

let board;
let piece;
let nextPiece;
let score;
let level;
let lines;
let dropCounter;
let lastTime;
let started;
let gameOver;
let paused;
let isClearingLines;
let clearingLines;
let lineClearStartedAt;
let lineClearMultiplier;
let particles;
let cellSize;
let nextCellSize;
let hardDropImpactStartedAt;
let animationFrameId;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function createPiece() {
  const matrix = cloneMatrix(SHAPES[Math.floor(Math.random() * SHAPES.length)]);

  return {
    matrix,
    x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2),
    y: 0,
  };
}

function getDropInterval() {
  return Math.max(120, BASE_DROP_INTERVAL - (level - 1) * 75);
}

function drawCell(targetContext, x, y, value, size) {
  const cellX = x * size;
  const cellY = y * size;
  const radius = Math.max(6, size * 0.22);
  const padding = Math.max(2, size * 0.08);

  targetContext.save();
  targetContext.shadowColor = "rgba(126, 92, 134, 0.22)";
  targetContext.shadowBlur = size * 0.16;
  targetContext.shadowOffsetY = size * 0.08;
  targetContext.fillStyle = COLORS[value];
  targetContext.beginPath();
  targetContext.roundRect(cellX + padding, cellY + padding, size - padding * 2, size - padding * 2, radius);
  targetContext.fill();
  targetContext.restore();

  targetContext.fillStyle = "rgba(255, 255, 255, 0.38)";
  targetContext.beginPath();
  targetContext.roundRect(cellX + padding + 3, cellY + padding + 3, size - padding * 2 - 6, Math.max(5, size * 0.24), radius * 0.7);
  targetContext.fill();
}

function drawGrid() {
  context.strokeStyle = "rgba(169, 150, 198, 0.18)";
  context.lineWidth = 1;

  for (let x = 0; x <= COLS; x += 1) {
    context.beginPath();
    context.moveTo(x * cellSize, 0);
    context.lineTo(x * cellSize, ROWS * cellSize);
    context.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * cellSize);
    context.lineTo(COLS * cellSize, y * cellSize);
    context.stroke();
  }
}

function drawMatrix(targetContext, matrix, offset, size) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== EMPTY) {
        drawCell(targetContext, x + offset.x, y + offset.y, value, size);
      }
    });
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    context.save();
    context.globalAlpha = particle.alpha;
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.fillStyle = particle.color;
    context.beginPath();

    if (particle.type === "circle") {
      context.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
      context.fill();
    } else if (particle.type === "star") {
      drawStar(context, particle.size);
    } else {
      context.roundRect(
        -particle.size / 2,
        -particle.size / 2,
        particle.size,
        particle.size,
        particle.size * 0.35
      );
      context.fill();
    }

    context.restore();
  });
}

function drawStar(targetContext, size) {
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.48;

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) {
      targetContext.moveTo(x, y);
    } else {
      targetContext.lineTo(x, y);
    }
  }

  targetContext.closePath();
  targetContext.fill();
}

function drawNextPiece() {
  nextContext.fillStyle = "#fffaf0";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const matrix = nextPiece.matrix;
  const offset = {
    x: Math.floor((nextCanvas.width / nextCellSize - matrix[0].length) / 2),
    y: Math.floor((nextCanvas.height / nextCellSize - matrix.length) / 2),
  };

  drawMatrix(nextContext, matrix, offset, nextCellSize);
}

function drawOverlay(title, subtitle) {
  context.fillStyle = "rgba(255, 248, 232, 0.84)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#7a5c7d";
  context.font = "800 26px Trebuchet MS, Arial";
  context.textAlign = "center";
  context.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
  context.font = "700 16px Trebuchet MS, Arial";
  context.fillStyle = "#e66f99";
  context.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 24);
}

function draw() {
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  applyLineClearBounce();
  applyHardDropImpact();
  drawGrid();
  drawMatrix(context, board, { x: 0, y: 0 }, cellSize);
  drawLineClearGlow();
  if (!isClearingLines) {
    drawMatrix(context, piece.matrix, piece, cellSize);
  }
  drawParticles();
  context.restore();
  drawNextPiece();

  if (gameOver) {
    drawOverlay("아쉬워요!", "다시 하기 버튼을 눌러요");
  } else if (paused) {
    drawOverlay("잠깐 쉬는 중", "P 또는 버튼으로 계속해요");
  }
}

function collide(targetBoard, targetPiece) {
  const { matrix, x: pieceX, y: pieceY } = targetPiece;

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (
        matrix[y][x] !== EMPTY &&
        (targetBoard[y + pieceY]?.[x + pieceX] ?? 1) !== EMPTY
      ) {
        return true;
      }
    }
  }

  return false;
}

function merge() {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== EMPTY) {
        board[y + piece.y][x + piece.x] = value;
      }
    });
  });
}

function updateStats() {
  level = Math.floor(lines / 10) + 1;
  scoreElement.textContent = score;
  levelElement.textContent = level;
  if (linesElement) {
    linesElement.textContent = lines;
  }
}

function updateState(text) {
  if (stateElement) {
    stateElement.textContent = text;
  }
  pauseButton.textContent = paused ? "계속하기" : "잠깐 멈춤";
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getLineClearProgress() {
  if (!isClearingLines) {
    return 0;
  }

  return Math.min(1, (now() - lineClearStartedAt) / LINE_CLEAR_EFFECT_DURATION);
}

function findCompletedLines() {
  const completed = [];

  outer: for (let y = board.length - 1; y >= 0; y -= 1) {
    for (let x = 0; x < board[y].length; x += 1) {
      if (board[y][x] === EMPTY) {
        continue outer;
      }
    }

    completed.push(y);
  }

  return completed;
}

function createLineClearParticles(completedLines) {
  particles = [];
  const particleCount = Math.min(
    MAX_PARTICLES,
    completedLines.length * COLS * Math.round(PARTICLES_PER_CELL * lineClearMultiplier)
  );
  let created = 0;

  // Full rows burst into bigger pastel pieces, circles, and stars before the board is changed.
  completedLines.forEach((y) => {
    for (let x = 0; x < COLS; x += 1) {
      const color = COLORS[board[y][x]];
      const centerX = x * cellSize + cellSize / 2;
      const centerY = y * cellSize + cellSize / 2;
      const perCell = Math.round(PARTICLES_PER_CELL * lineClearMultiplier);

      for (let i = 0; i < perCell && created < particleCount; i += 1) {
        const angle = -Math.PI + Math.random() * Math.PI;
        const speed = (1.8 + Math.random() * 3.4) * lineClearMultiplier;
        const sparkle = Math.random() > 0.64;

        particles.push({
          x: centerX,
          y: centerY,
          startX: centerX,
          startY: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.2 * lineClearMultiplier,
          size: sparkle ? 8 + Math.random() * 5 : 6 + Math.random() * 6,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.32,
          color: sparkle ? randomSparkleColor() : color,
          alpha: 1,
          type: randomParticleType(sparkle),
        });
        created += 1;
      }
    }
  });
}

function startLineClearEffect(completedLines) {
  isClearingLines = true;
  clearingLines = completedLines;
  lineClearMultiplier = completedLines.length >= 4 ? 1.6 : completedLines.length >= 2 ? 1.3 : 1;
  lineClearStartedAt = now();
  createLineClearParticles(completedLines);
}

function randomParticleType(sparkle) {
  if (sparkle) {
    return Math.random() > 0.35 ? "star" : "circle";
  }

  const types = ["square", "circle", "star"];
  return types[Math.floor(Math.random() * types.length)];
}

function randomSparkleColor() {
  const colors = ["#ffffff", "#fff4bf", "#ffd9e8", "#cbeeff", "#e8dcff"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function drawLineClearGlow() {
  if (!isClearingLines) {
    return;
  }

  const elapsed = now() - lineClearStartedAt;
  const progress = getLineClearProgress();
  const flashAlpha =
    elapsed < LINE_CLEAR_FLASH_DURATION
      ? 0.6 + Math.sin((elapsed / LINE_CLEAR_FLASH_DURATION) * Math.PI) * 0.28
      : Math.max(0, 0.38 * (1 - progress));
  const popScale = elapsed < LINE_CLEAR_FLASH_DURATION ? 1 + Math.sin((elapsed / LINE_CLEAR_FLASH_DURATION) * Math.PI) * 0.1 : 1;

  clearingLines.forEach((y) => {
    context.save();
    context.globalAlpha = flashAlpha;
    context.fillStyle = "#fff8c9";
    context.shadowColor = "rgba(255, 214, 111, 0.72)";
    context.shadowBlur = 22 * lineClearMultiplier;
    context.fillRect(0, y * cellSize, COLS * cellSize, cellSize);
    context.restore();

    context.save();
    context.globalAlpha = Math.max(0, 0.42 * (1 - progress));
    context.translate((COLS * cellSize) / 2, y * cellSize + cellSize / 2);
    context.scale(popScale, popScale);
    context.translate(-(COLS * cellSize) / 2, -(y * cellSize + cellSize / 2));
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x] !== EMPTY) {
        drawCell(context, x, y, board[y][x], cellSize);
      }
    }
    context.restore();
  });
}

function applyLineClearBounce() {
  if (!isClearingLines || clearingLines.length < 2) {
    return;
  }

  const elapsed = now() - lineClearStartedAt;
  const duration = clearingLines.length >= 4 ? 160 : 110;

  if (elapsed > duration) {
    return;
  }

  const strength = clearingLines.length >= 4 ? 4.5 : 2.5;
  const offset = Math.sin((elapsed / duration) * Math.PI * 2) * strength * (1 - elapsed / duration);
  context.translate(0, offset);
}

function updateLineClearEffect(currentTime) {
  if (!isClearingLines) {
    return;
  }

  const progress = Math.min(1, (currentTime - lineClearStartedAt) / LINE_CLEAR_EFFECT_DURATION);

  particles.forEach((particle) => {
    particle.x = particle.startX + particle.vx * progress * 42;
    particle.y = particle.startY + particle.vy * progress * 42 + progress * progress * 22;
    particle.rotation += particle.spin;
    particle.alpha = Math.max(0, 1 - progress * 1.12);
  });

  if (progress >= 1) {
    finishLineClearEffect();
  }
}

function finishLineClearEffect() {
  const linesCleared = clearingLines.length;

  // Remove all completed rows together after the animation so multi-line clears stay in sync.
  clearingLines
    .slice()
    .sort((a, b) => b - a)
    .forEach((y) => {
      board.splice(y, 1);
    });

  for (let i = 0; i < linesCleared; i += 1) {
    board.unshift(Array(COLS).fill(EMPTY));
  }

  if (linesCleared > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    score += lineScores[linesCleared] * level;
    lines += linesCleared;
    updateStats();
  }

  particles = [];
  clearingLines = [];
  isClearingLines = false;
  spawnNextPiece();
}

function spawnNextPiece() {
  piece = nextPiece;
  nextPiece = createPiece();

  if (collide(board, piece)) {
    gameOver = true;
    paused = false;
    updateState("아쉬워요! 한 번 더 해볼까요?");
  }
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  const rotated = rotate(piece.matrix);
  const previousX = piece.x;
  let offset = 1;

  piece.matrix = rotated;

  while (collide(board, piece)) {
    piece.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));

    if (Math.abs(offset) > piece.matrix[0].length) {
      piece.matrix = rotate(rotate(rotate(rotated)));
      piece.x = previousX;
      return;
    }
  }
}

function lockPiece() {
  merge();
  const completedLines = findCompletedLines();

  if (completedLines.length > 0) {
    startLineClearEffect(completedLines);
    return;
  }

  spawnNextPiece();
}

function drop() {
  piece.y += 1;

  if (collide(board, piece)) {
    piece.y -= 1;
    lockPiece();
  }

  dropCounter = 0;
}

function hardDropPiece() {
  if (!canControlPiece()) {
    return;
  }

  while (!collide(board, { ...piece, y: piece.y + 1 })) {
    piece.y += 1;
  }

  hardDropImpactStartedAt = now();
  lockPiece();
  dropCounter = 0;
}

function canControlPiece() {
  return started && !gameOver && !paused && !isClearingLines;
}

function applyHardDropImpact() {
  if (!hardDropImpactStartedAt || isClearingLines) {
    return;
  }

  const elapsed = now() - hardDropImpactStartedAt;

  if (elapsed > HARD_DROP_IMPACT_DURATION) {
    hardDropImpactStartedAt = 0;
    return;
  }

  const progress = elapsed / HARD_DROP_IMPACT_DURATION;
  const offset = Math.sin(progress * Math.PI) * 3 * (1 - progress);
  context.translate(0, offset);
}

function getViewportHeight() {
  return window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
}

function resizeGameForViewport() {
  const isMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

  if (isMobile) {
    const styles = window.getComputedStyle(document.body);
    const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const topHudHeight = Math.max(
      document.querySelector(".stats-grid")?.getBoundingClientRect().height || 0,
      document.querySelector(".next-block")?.getBoundingClientRect().height || 0
    );
    const buttonsHeight = document.querySelector(".button-row")?.getBoundingClientRect().height || 0;
    const touchHeight = document.querySelector(".touch-pad")?.getBoundingClientRect().height || 0;
    const reservedHeight = topHudHeight + buttonsHeight + touchHeight + verticalPadding + 32;
    const availableWidth = window.innerWidth - 32;
    const availableHeight = getViewportHeight() - reservedHeight;

    cellSize = Math.max(
      14,
      Math.floor(Math.min(availableWidth / COLS, availableHeight / ROWS))
    );
    nextCellSize = Math.max(9, Math.min(13, Math.floor(cellSize * 0.5)));
  } else {
    cellSize = DESKTOP_CELL;
    nextCellSize = DESKTOP_NEXT_CELL;
  }

  canvas.width = cellSize * COLS;
  canvas.height = cellSize * ROWS;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;

  nextCanvas.width = nextCellSize * 5;
  nextCanvas.height = nextCellSize * 5;
  nextCanvas.style.width = `${nextCanvas.width}px`;
  nextCanvas.style.height = `${nextCanvas.height}px`;

  draw();
}

function move(direction) {
  piece.x += direction;

  if (collide(board, piece)) {
    piece.x -= direction;
  }
}

function togglePause() {
  if (gameOver || !started || isClearingLines) {
    return;
  }

  paused = !paused;
  updateState(paused ? "잠깐 쉬는 중" : "신나게 하는 중");
  draw();
}

function runPlayerAction(action) {
  if (!started && action === "rotate") {
    beginGame();
    return;
  }

  if (!canControlPiece()) {
    return;
  }

  if (action === "left") {
    move(-1);
  } else if (action === "right") {
    move(1);
  } else if (action === "drop") {
    drop();
  } else if (action === "hardDrop") {
    hardDropPiece();
  } else if (action === "rotate") {
    rotatePiece();
  }

  draw();
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;
  const currentTime = now();

  if (canControlPiece()) {
    dropCounter += deltaTime;

    if (dropCounter > getDropInterval()) {
      drop();
    }
  }

  updateLineClearEffect(currentTime);
  draw();
  animationFrameId = requestAnimationFrame(update);
}

function startGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  board = createBoard();
  piece = createPiece();
  nextPiece = createPiece();
  score = 0;
  level = 1;
  lines = 0;
  dropCounter = 0;
  lastTime = 0;
  started = false;
  gameOver = false;
  paused = false;
  isClearingLines = false;
  clearingLines = [];
  lineClearStartedAt = 0;
  lineClearMultiplier = 1;
  particles = [];
  hardDropImpactStartedAt = 0;
  resizeGameForViewport();
  updateStats();
  updateState("");
  update();
}

function beginGame() {
  if (gameOver) {
    startGame();
  }

  started = true;
  paused = false;
  lastTime = 0;
  dropCounter = 0;
  updateState("신나게 하는 중");
  draw();
}

document.addEventListener("keydown", (event) => {
  if (!started && (event.key === "Enter" || event.code === "Space")) {
    beginGame();
    event.preventDefault();
    return;
  }

  if (event.key.toLowerCase() === "p") {
    togglePause();
    event.preventDefault();
    return;
  }

  if (!canControlPiece()) {
    return;
  }

  if (event.key === "ArrowLeft") {
    runPlayerAction("left");
  } else if (event.key === "ArrowRight") {
    runPlayerAction("right");
  } else if (event.key === "ArrowDown") {
    drop();
    draw();
  } else if (event.key === "ArrowUp" || event.code === "Space") {
    runPlayerAction("rotate");
  } else {
    return;
  }

  event.preventDefault();
});

startButton.addEventListener("click", beginGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", () => {
  startGame();
  beginGame();
});

touchButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    runPlayerAction(button.dataset.action);
  });
});

window.addEventListener("resize", resizeGameForViewport);
window.addEventListener("orientationchange", resizeGameForViewport);
window.visualViewport?.addEventListener("resize", resizeGameForViewport);

startGame();
