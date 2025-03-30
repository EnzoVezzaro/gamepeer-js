// Use global GamePeerJS from UMD bundle
const GamePeerJS = window.GamePeerJS;

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Initialize the SDK with mouse controller
    const game = new GamePeerJS({
      debug: true,
      useKeyboardController: true,
      useMouseController: true,
      localPlayerId: `player-${Math.random().toString(36).substr(2, 8)}`
    });

    // Get DOM elements
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    
    const hostBtn = document.getElementById('hostBtn');
    const joinBtn = document.getElementById('joinBtn');
    const roomInput = document.getElementById('roomIdInput');
    const roomInfo = document.getElementById('roomInfo');
    
    if (!hostBtn || !joinBtn || !roomInput || !roomInfo) {
      throw new Error('Missing required UI elements');
    }

    // Setup mouse controller
    console.log('[muouse controller]: ', game);
    const mouse = game.mouseController({
      connectionManager: game.connectionManager
    });
    mouse.setup(canvas);

    // Handle keyboard input
    const moveSpeed = 5;
    document.addEventListener('keydown', (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    }, {capture: true});

    // Setup canvas
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';
    canvas.focus();
      
    // Host game button
    hostBtn.onclick = async () => {
      try {
        const roomId = await game.hostGame();
        roomInfo.textContent = `Room ID: ${roomId}`;
        hostBtn.disabled = true;
        joinBtn.disabled = true;
      } catch (err) {
        alert('Failed to host game: ' + err.message);
      }
    };
    
    // Join game button
    joinBtn.onclick = async () => {
      try {
        const roomId = roomInput.value.trim();
        if (!roomId) {
          alert('Please enter a room ID');
          return;
        }
        await game.joinGame(roomId);
        roomInfo.textContent = `Joined Room: ${roomId}`;
        hostBtn.disabled = true;
        joinBtn.disabled = true;
      } catch (err) {
        alert('Failed to join game: ' + err.message);
      }
    };

    // Handle mouse movement through controller
    mouse.on('mousemove', ({x, y}) => {
      game.movePlayer(x, y);
    });

    // Handle shooting
    mouse.on('click', ({x, y}) => {
      const bulletId = 'bullet_' + Date.now();
      game.createGameObject(bulletId, {
        type: 'bullet',
        x: x,
        y: y,
        radius: 5,
        color: '#000000',
        ownerId: game.localPlayerId
      });

      game.broadcastEvent('bullet', {
        bulletId: bulletId,
        x: x,
        y: y,
        ownerId: game.localPlayerId
      });
    });

    // Handle bullet collisions
    game.on('bullet', (bulletData) => {
      // Check collisions with all players
      Object.values(game.players).forEach(player => {
        if (!player.id) return;
        
        const dx = bulletData.x - player.x;
        const dy = bulletData.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 25 && player.id !== bulletData.ownerId) {
          // Create hit notification
          game.createGameObject('hitNotification', {
            targetPlayerId: player.id,
            bulletId: bulletData.bulletId,
            message: 'You got hit!'
          });
          
          if (player.id === game.localPlayerId) {
            alert('You got hit by a bullet!');
          }
        }
      });
    });

    // Handle state updates
    game.on('stateUpdate', (data) => {
      if (data.objectId) {
        if (data.objectId.startsWith('player_')) {
          game.players[data.objectId] = game.players[data.objectId] || {};
          Object.assign(game.players[data.objectId], data.data);
        } else {
          game.gameObjects[data.objectId] = game.gameObjects[data.objectId] || {};
          Object.assign(game.gameObjects[data.objectId], data.data);
        }
      }
    });

    // Game loop
    function gameLoop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Render players
      Object.entries(game.players).forEach(([id, player]) => {
        ctx.fillStyle = player.color || '#FF0000';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        if (id === game.localPlayerId) {
          ctx.strokeStyle = '#FFFF00';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.name} (${id})`, player.x, player.y - 25);
      });
      
      // Render bullets
      Object.entries(game.gameObjects).forEach(([id, obj]) => {
        if (obj.type === 'bullet') {
          ctx.fillStyle = obj.color || '#000000';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.radius || 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      requestAnimationFrame(gameLoop);
    }
    
    gameLoop();
    
  } catch (err) {
    console.error('Game initialization failed:', err);
    alert('Failed to initialize game: ' + err.message);
  }
});
