// Use global GamePeerSDK from UMD bundle
const GamePeerSDK = window.GamePeerSDK;

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Initialize the SDK
    const game = new GamePeerSDK({
      debug: true,
      useKeyboardController: true,
      localPlayerId: `player-${Math.random().toString(36).substr(2, 8)}`
    });

    console.log('passing player id: ', `player-${Math.random().toString(36).substr(2, 8)}`);
    
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

    // Handle bullet collisions
    game.on('bullet', (bulletData) => {
      console.log('Bullet created:', bulletData);
      
      // Check collisions with all players
      Object.values(game.players).forEach(player => {
        if (!player.id) return;
        
        const dx = bulletData.x - player.x;
        const dy = bulletData.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        console.log(`Distance to player ${player.id}:`, distance, player.id, bulletData);
        
        if (distance < 25 && player.id !== bulletData.ownerId) {
          console.log(`Player ${player.id} hit by bullet!`);
          
          // Create hit notification
          game.createGameObject('hitNotification', {
            targetPlayerId: player.id,
            bulletId: bulletData.bulletId,
            message: 'You got hit!'
          });
          
          // Show alert if local player was hit
          if (player.id === game.localPlayerId) {
            alert('You got hit by a bullet!');
          }
        }
      });
    });

    // Handle state updates
    game.on('stateUpdate', (data) => {
      // console.log('[stateUpdate] receiving updates: ', data);
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

    // Listen for bullet events from peers
    game.on('bullet', (bulletData) => {
      console.log('[PEER] Received bullet event:', bulletData);
      
      if (!bulletData.bulletId || !bulletData.x || !bulletData.y) {
        console.warn('Invalid bullet data received');
        return;
      }
      
      // Create/sync bullet object
      if (!game.gameObjects[bulletData.bulletId]) {
        game.createGameObject(bulletData.bulletId, {
          type: 'bullet', 
          x: bulletData.x,
          y: bulletData.y,
          radius: 5,
          color: '#000000',
          ownerId: bulletData.ownerId
        });
      } else {
        game.syncGameObject(bulletData.bulletId, {
          x: bulletData.x,
          y: bulletData.y
        });
      }
    });
    
    gameLoop();

    // Mouse movement handler
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      game.movePlayer(x, y);
    });

    // Click to shoot
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Create bullet with unique ID
      const bulletId = 'bullet_' + Date.now();
      game.createGameObject(bulletId, {
        type: 'bullet',
        x: x,
        y: y,
        radius: 5,
        color: '#000000',
        ownerId: game.localPlayerId
      });

      console.log('Bullet created by:', game.localPlayerId, 'at:', {x, y});
      
      // Broadcast bullet event to all peers
      game.broadcastEvent('bullet', {
        bulletId: bulletId,
        x: x,
        y: y,
        ownerId: game.localPlayerId
      });
    });
    
  } catch (err) {
    console.error('Game initialization failed:', err);
    alert('Failed to initialize game: ' + err.message);
  }
});
