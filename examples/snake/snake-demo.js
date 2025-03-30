// Snake Game Demo using GamePeerJS
const GamePeerJS = window.GamePeerJS;

// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreDisplay = document.getElementById('score');
  const gameOverDisplay = document.getElementById('game-over');
  
  // Initialize game with keyboard controller
  const game = new GamePeerJS({
    debug: true,
    useKeyboardController: true,
    localPlayerId: `snake-${Math.random().toString(36).substr(2, 4)}`
  });

  console.log('game engine init: ', game);

  // Game state
  let snake = [];
  let food = {};
  let direction = 'right';
  let nextDirection = 'right';
  let score = 0;
  let gameSpeed = INITIAL_SPEED;
  let gameLoopInterval;
  let isGameOver = false;
  let keyboard = null;

  // Host or join game
  document.getElementById('hostBtn').onclick = async () => {
    const roomId = await game.hostGame();
    console.log('roomId: ', roomId, game);
    // Get the pre-initialized keyboard controller
    setTimeout(() => {
      initKeyboardService();
    }, 2000);
    initGame();
  };

  document.getElementById('joinBtn').onclick = async () => {
    const roomId = document.getElementById('roomInput').value;
    console.log('joining room: ', roomId);
    await game.joinGame(roomId);
    initKeyboardService();
    initGame();
  };

  // Initialize game state
  function initGame() {
    console.log('Initializing game...');
    const startX = Math.floor(GRID_SIZE / 4);
    const startY = Math.floor(GRID_SIZE / 2);
    snake = [
      {x: startX, y: startY},
      {x: startX-1, y: startY},
      {x: startX-2, y: startY}
    ];
    
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    gameSpeed = INITIAL_SPEED;
    isGameOver = false;
    
    generateFood();
    updateScore();
    gameOverDisplay.style.display = 'none';
    
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, gameSpeed);
  }

  function initKeyboardService() {
    console.log('init keyboard: ', game);
    keyboard = game.getKeyboardController(); 
    console.log('Keyboard controller instance:', keyboard);
    // Set up keyboard controls
    keyboard.on('up', (data) => { 
      if (!data || data.playerId !== game.localPlayerId) {
        if (direction !== 'down') nextDirection = 'up';
      }
    }).on('down', (data) => { 
      if (!data || data.playerId !== game.localPlayerId) {
        if (direction !== 'up') nextDirection = 'down';
      }
    }).on('left', (data) => { 
      if (!data || data.playerId !== game.localPlayerId) {
        if (direction !== 'right') nextDirection = 'left';
      }
    }).on('right', (data) => { 
      if (!data || data.playerId !== game.localPlayerId) {
        if (direction !== 'left') nextDirection = 'right';
      }
    });
  }

  // Main game loop
  function gameLoop() {
    if (isGameOver) return;
    
    direction = nextDirection;
    moveSnake();
    
    if (checkCollision()) {
      gameOver();
      return;
    }
    
    if (snake[0].x === food.x && snake[0].y === food.y) {
      eatFood();
    }
    
    draw();
  }

  function moveSnake() {
    const head = {...snake[0]};
    
    switch(direction) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }
    
    if (head.x >= GRID_SIZE) head.x = 0;
    if (head.x < 0) head.x = GRID_SIZE - 1;
    if (head.y >= GRID_SIZE) head.y = 0;
    if (head.y < 0) head.y = GRID_SIZE - 1;
    
    snake.unshift(head);
    snake.pop();
  }

  function checkCollision() {
    const head = snake[0];
    for (let i = 1; i < snake.length; i++) {
      if (head.x === snake[i].x && head.y === snake[i].y) {
        return true;
      }
    }
    return false;
  }

  function eatFood() {
    const tail = {...snake[snake.length-1]};
    snake.push(tail);
    score += 10;
    updateScore();
    gameSpeed = Math.max(INITIAL_SPEED - (score / 2), 50);
    clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, gameSpeed);
    generateFood();
  }

  function generateFood() {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    for (const segment of snake) {
      if (segment.x === food.x && segment.y === food.y) {
        return generateFood();
      }
    }
  }

  function gameOver() {
    isGameOver = true;
    clearInterval(gameLoopInterval);
    gameOverDisplay.style.display = 'block';
  }

  function updateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
    game.broadcastEvent('scoreUpdate', { score });
  }

  function draw() {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#333';
    for (const segment of snake) {
      ctx.fillRect(
        segment.x * CELL_SIZE, 
        segment.y * CELL_SIZE, 
        CELL_SIZE, 
        CELL_SIZE
      );
    }
    
    ctx.fillStyle = '#0066cc';
    ctx.fillRect(
      snake[0].x * CELL_SIZE, 
      snake[0].y * CELL_SIZE, 
      CELL_SIZE, 
      CELL_SIZE
    );
    
    ctx.fillStyle = '#cc3300';
    ctx.fillRect(
      food.x * CELL_SIZE, 
      food.y * CELL_SIZE, 
      CELL_SIZE, 
      CELL_SIZE
    );
  }

  game.on('scoreUpdate', (data) => {
    if (data.score > score) {
      score = data.score;
      updateScore();
    }
  });
});
