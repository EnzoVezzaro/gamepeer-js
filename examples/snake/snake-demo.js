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
  
  // Initialize game
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

  // Initialize keyboard controller
  console.log('Initializing keyboard controller...');
  const keyboard = game.keyboardController({
    keybindings: [
      ['up', 'ArrowUp'],
      ['down', 'ArrowDown'],
      ['left', 'ArrowLeft'], 
      ['right', 'ArrowRight']
    ]
  });
  console.log('Keyboard controller instance:', keyboard);

  // Verify event binding
  keyboard.on('up', () => { 
    console.log('UP key pressed - handler called');
    if (direction !== 'down') nextDirection = 'up'; 
  }).on('down', () => { 
    console.log('DOWN key pressed - handler called'); 
    if (direction !== 'up') nextDirection = 'down'; 
  }).on('left', () => { 
    console.log('LEFT key pressed - handler called');
    if (direction !== 'right') nextDirection = 'left'; 
  }).on('right', () => { 
    console.log('RIGHT key pressed - handler called');
    if (direction !== 'left') nextDirection = 'right'; 
  });

  console.log('Keyboard event handlers registered');

  // Host or join game
  document.getElementById('hostBtn').onclick = async () => {
    await game.hostGame();
    initGame();
  };

  document.getElementById('joinBtn').onclick = async () => {
    const roomId = document.getElementById('roomInput').value;
    await game.joinGame(roomId);
    initGame();
  };

  // Initialize game state
  function initGame() {
    console.log('Initializing game...');
    // Create initial snake
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
    
    // Start game loop
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, gameSpeed);
  }

  // Main game loop
  function gameLoop() {
    if (isGameOver) return;
    
    direction = nextDirection;
    moveSnake();
    
    // Check collisions
    if (checkCollision()) {
      gameOver();
      return;
    }
    
    // Check food
    if (snake[0].x === food.x && snake[0].y === food.y) {
      eatFood();
    }
    
    // Draw everything
    draw();
  }

  // Move snake
  function moveSnake() {
    // console.log('Moving snake, direction:', direction);
    const head = {...snake[0]};
    
    switch(direction) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }
    
    // Wrap around edges
    if (head.x >= GRID_SIZE) head.x = 0;
    if (head.x < 0) head.x = GRID_SIZE - 1;
    if (head.y >= GRID_SIZE) head.y = 0;
    if (head.y < 0) head.y = GRID_SIZE - 1;
    
    snake.unshift(head);
    snake.pop();
  }

  // Check collisions
  function checkCollision() {
    const head = snake[0];
    
    // Check self collision
    for (let i = 1; i < snake.length; i++) {
      if (head.x === snake[i].x && head.y === snake[i].y) {
        return true;
      }
    }
    
    return false;
  }

  // Handle eating food
  function eatFood() {
    // Grow snake
    const tail = {...snake[snake.length-1]};
    snake.push(tail);
    
    // Increase score
    score += 10;
    updateScore();
    
    // Increase speed
    gameSpeed = Math.max(INITIAL_SPEED - (score / 2), 50);
    clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, gameSpeed);
    
    // Generate new food
    generateFood();
  }

  // Generate food at random position
  function generateFood() {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    
    // Make sure food doesn't spawn on snake
    for (const segment of snake) {
      if (segment.x === food.x && segment.y === food.y) {
        return generateFood();
      }
    }
  }

  // Game over
  function gameOver() {
    isGameOver = true;
    clearInterval(gameLoopInterval);
    gameOverDisplay.style.display = 'block';
  }

  // Update score display
  function updateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
    game.broadcastEvent('scoreUpdate', { score });
  }

  // Draw game
  function draw() {
    console.log('Drawing game state');
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw snake
    ctx.fillStyle = '#333';
    for (const segment of snake) {
      ctx.fillRect(
        segment.x * CELL_SIZE, 
        segment.y * CELL_SIZE, 
        CELL_SIZE, 
        CELL_SIZE
      );
    }
    
    // Draw head
    ctx.fillStyle = '#0066cc';
    ctx.fillRect(
      snake[0].x * CELL_SIZE, 
      snake[0].y * CELL_SIZE, 
      CELL_SIZE, 
      CELL_SIZE
    );
    
    // Draw food
    ctx.fillStyle = '#cc3300';
    ctx.fillRect(
      food.x * CELL_SIZE, 
      food.y * CELL_SIZE, 
      CELL_SIZE, 
      CELL_SIZE
    );
  }

  // Listen for score updates from other players
  game.on('scoreUpdate', (data) => {
    if (data.score > score) {
      score = data.score;
      updateScore();
    }
  });
});
