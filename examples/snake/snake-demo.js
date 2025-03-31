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
  let snakes = {}; // Track snakes by playerId
  let food = {};
  let directions = {}; // Track directions by playerId
  let nextDirections = {}; // Track next directions by playerId
  let score = 0;
  let gameSpeed = INITIAL_SPEED;
  let gameLoopInterval;
  let isGameOver = false;
  let keyboard = null;
  let localSnakeId = null;

  // Host or join game
  document.getElementById('hostBtn').onclick = async () => {
    const roomId = await game.hostGame();
    console.log('roomId: ', roomId, game);
    
    // Update room input UI
    const roomInput = document.getElementById('roomInput');
    roomInput.value = roomId;
    roomInput.disabled = true;
    
    // Add copy button if not already exists
    if (!document.getElementById('copyRoomBtn')) {
      const copyBtn = document.createElement('button');
      copyBtn.id = 'copyRoomBtn';
      copyBtn.textContent = 'Copy';
      copyBtn.style.marginLeft = '5px';
      copyBtn.style.padding = '2px 5px';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(roomId);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
      };
      roomInput.parentNode.insertBefore(copyBtn, roomInput.nextSibling);
    }
    
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
    
    // Initialize local player's snake
    localSnakeId = game.localPlayerId;
    snakes[localSnakeId] = [
      {x: startX, y: startY},
      {x: startX-1, y: startY},
      {x: startX-2, y: startY}
    ];
    
    directions[localSnakeId] = 'right';
    nextDirections[localSnakeId] = 'right';
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
      updatePosition(data, 'up');
    }).on('down', (data) => { 
      updatePosition(data, 'down');
    }).on('left', (data) => { 
      updatePosition(data, 'left');
    }).on('right', (data) => { 
      updatePosition(data, 'right');
    });
  }

  // Main game loop
  function gameLoop() {
    if (isGameOver) return;
    
    // Update directions from nextDirections
    for (const playerId in nextDirections) {
      directions[playerId] = nextDirections[playerId];
    }
    
    moveSnake();
    
    if (checkCollision()) {
      gameOver();
      return;
    }
    
    eatFood();
    draw();
  }

  function moveSnake() {
    // Move all snakes
    for (const playerId in snakes) {
      const snake = snakes[playerId];
      const direction = directions[playerId];
      
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
  }

  function checkCollision() {
    // Only check for self-collisions (head hitting own body)
    for (const playerId in snakes) {
      const snake = snakes[playerId];
      const head = snake[0];
      
      for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
          return true;
        }
      }
    }
    return false;
  }

  function eatFood() {
    // Check if any snake ate the food
    for (const playerId in snakes) {
      const snake = snakes[playerId];
      if (snake[0].x === food.x && snake[0].y === food.y) {
        const tail = {...snake[snake.length-1]};
        snake.push(tail);
        score += 10;
        updateScore();
        gameSpeed = Math.max(INITIAL_SPEED - (score / 2), 50);
        clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, gameSpeed);
        generateFood();
        break;
      }
    }
  }

  function generateFood() {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    
    // Check all snake segments
    for (const playerId in snakes) {
      for (const segment of snakes[playerId]) {
        if (segment.x === food.x && segment.y === food.y) {
          return generateFood();
        }
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

  function updatePosition(data, nextDirection) {
    // Initialize snake if it doesn't exist
    if (!snakes[data.playerId]) {
      console.log('[updatePosition] initializing snake for', data.playerId);
      const startX = Math.floor(GRID_SIZE * 3 / 4);
      const startY = Math.floor(GRID_SIZE / 2);
      snakes[data.playerId] = [
        {x: startX, y: startY},
        {x: startX-1, y: startY},
        {x: startX-2, y: startY}
      ];
      directions[data.playerId] = 'left';
      nextDirections[data.playerId] = 'left';
    }

    const currentDir = directions[data.playerId] || 'left';
    // Prevent 180-degree turns
    if ((currentDir === 'up' && nextDirection !== 'down') ||
        (currentDir === 'down' && nextDirection !== 'up') ||
        (currentDir === 'left' && nextDirection !== 'right') ||
        (currentDir === 'right' && nextDirection !== 'left')) {
      nextDirections[data.playerId] = nextDirection;
      console.log('[updatePosition] updated direction for', data.playerId, 'to', nextDirection);
    }
  }

  function draw() {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all snakes
    for (const playerId in snakes) {
      const snake = snakes[playerId];
      const isLocal = playerId === localSnakeId;
      
      // Draw snake body
      ctx.fillStyle = isLocal ? '#0066cc' : '#333';
      for (const segment of snake) {
        ctx.fillRect(
          segment.x * CELL_SIZE, 
          segment.y * CELL_SIZE, 
          CELL_SIZE, 
          CELL_SIZE
        );
      }
      
      // Draw snake head
      ctx.fillStyle = isLocal ? '#00cc66' : '#0066cc';
      ctx.fillRect(
        snake[0].x * CELL_SIZE, 
        snake[0].y * CELL_SIZE, 
        CELL_SIZE, 
        CELL_SIZE
      );
    }
    
    // Draw food
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

  // Handle new players joining
  game.on('playerJoined', (playerId) => {
    if (playerId === game.localPlayerId) return;
    
    // Initialize new player's snake
    const startX = Math.floor(GRID_SIZE * 3 / 4);
    const startY = Math.floor(GRID_SIZE / 2);
    snakes[playerId] = [
      {x: startX, y: startY},
      {x: startX-1, y: startY},
      {x: startX-2, y: startY}
    ];
    directions[playerId] = 'left';
    nextDirections[playerId] = 'left';
  });
});
