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

const COLS = 10;
const ROWS = 20;
const CELL = 36;
const NEXT_CELL = 26;
const EMPTY = 0;
const BASE_DROP_INTERVAL = 850;
const LINE_CLEAR_EFFECT_DURATION = 360;
const PARTICLES_PER_CELL = 5;

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
let particles;
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
    context.moveTo(x * CELL, 0);
    context.lineTo(x * CELL, ROWS * CELL);
    context.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * CELL);
    context.lineTo(COLS * CELL, y * CELL);
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
    context.roundRect(
      -particle.size / 2,
      -particle.size / 2,
      particle.size,
      particle.size,
      particle.size * 0.35
    );
    context.fill();
    context.restore();
  });
}

function drawNextPiece() {
  nextContext.fillStyle = "#fffaf0";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const matrix = nextPiece.matrix;
  const offset = {
    x: Math.floor((nextCanvas.width / NEXT_CELL - matrix[0].length) / 2),
    y: Math.floor((nextCanvas.height / NEXT_CELL - matrix.length) / 2),
  };

  drawMatrix(nextContext, matrix, offset, NEXT_CELL);
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
  drawGrid();
  drawMatrix(context, board, { x: 0, y: 0 }, CELL);
  if (!isClearingLines) {
    drawMatrix(context, piece.matrix, piece, CELL);
  }
  drawParticles();
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

  // Full rows briefly burst into soft pastel pieces before the board is changed.
  completedLines.forEach((y) => {
    for (let x = 0; x < COLS; x += 1) {
      const color = COLORS[board[y][x]];
      const centerX = x * CELL + CELL / 2;
      const centerY = y * CELL + CELL / 2;

      for (let i = 0; i < PARTICLES_PER_CELL; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 1.8;

        particles.push({
          x: centerX,
          y: centerY,
          startX: centerX,
          startY: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.7,
          size: 3 + Math.random() * 4,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.18,
          color,
          alpha: 1,
        });
      }
    }
  });
}

function startLineClearEffect(completedLines) {
  isClearingLines = true;
  clearingLines = completedLines;
  lineClearStartedAt = now();
  createLineClearParticles(completedLines);
}

function updateLineClearEffect(currentTime) {
  if (!isClearingLines) {
    return;
  }

  const progress = Math.min(1, (currentTime - lineClearStartedAt) / LINE_CLEAR_EFFECT_DURATION);

  particles.forEach((particle) => {
    particle.x = particle.startX + particle.vx * progress * 28;
    particle.y = particle.startY + particle.vy * progress * 28 + progress * progress * 14;
    particle.rotation += particle.spin;
    particle.alpha = 1 - progress;
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
      board.unshift(Array(COLS).fill(EMPTY));
    });

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

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;
  const currentTime = now();

  if (started && !gameOver && !paused && !isClearingLines) {
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
  particles = [];
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

  if (gameOver || paused || !started || isClearingLines) {
    return;
  }

  if (event.key === "ArrowLeft") {
    move(-1);
  } else if (event.key === "ArrowRight") {
    move(1);
  } else if (event.key === "ArrowDown") {
    drop();
  } else if (event.key === "ArrowUp" || event.code === "Space") {
    rotatePiece();
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

startGame();
