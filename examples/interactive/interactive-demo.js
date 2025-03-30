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

    // Handle bullet hit events
    game.on('bullet', (hitData) => {
      console.log('Bullet hit received:', hitData);
      // Immediately check for collisions at creation point
      Object.entries(game.players).forEach(([playerId, player]) => {
        const dx = hitData.x - player.x;
        const dy = hitData.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        console.log('getting distance from others: ', distance, player, hitData.playerId);
        if (distance && distance < 25 && player.id !== hitData.playerId) {
          game._triggerEvent('playerHit', {
            targetPlayerId: hitData.playerId,
            bulletId: hitData.bulletId,
            message: 'You got hit by a bullet!'
          });
        }
      });
    });

    game.on('playerHit', (hitData) => {
      console.log('Bullet hit received:', hitData);
      if (hitData.targetPlayerId === game.localPlayerId) {
        game.createGameObject('playerHit', {
          targetPlayerId: hitData.targetPlayerId,
          message: `${hitData.targetPlayerId} got hit by a bullet!`
        });
        alert(hitData.message);
      }
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
      
      requestAnimationFrame(gameLoop);
    }
    
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

      // Draw bullet
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Create bullet
      const bulletId = game.createGameObject('bullet', {
        x, y,
        radius: 5,
        speed: 5,
        direction: Math.random() * Math.PI * 2
      });

      console.log('getting player id bullet: ', game);

      game._triggerEvent('bullet', {
        playerId: game.localPlayerId,
        bulletId: bulletId,
        x,
        y,
        message: 'Fire Bullet!'
      });
    });
    
  } catch (err) {
    console.error('Game initialization failed:', err);
    alert('Failed to initialize game: ' + err.message);
  }
});
