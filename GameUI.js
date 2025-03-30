// Import the SDK
import GamePeerSDK from './dist/modules/GamePeerSDK.js';

class GameUI {
  constructor() {
    this.game = new GamePeerSDK({
      debug: true
    });
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.isHost = false;
    this.roomId = null;
    
    // Set up event listeners
    this._setupEventListeners();
    
    // Animation loop
    this._startRenderLoop();
  }
  
  // Initialize the UI
  init() {
    // Set canvas size
    this.canvas.width = 800;
    this.canvas.height = 600;
    
    // Setup UI elements
    this._createUI();
  }
  
  // Create a host game
  async createGame() {
    try {
      this.roomId = await this.game.hostGame();
      this.isHost = true;
      
      // Update UI to show room ID
      document.getElementById('roomInfo').textContent = `Room ID: ${this.roomId}`;
      document.getElementById('hostControls').style.display = 'block';
      document.getElementById('joinControls').style.display = 'none';
    } catch (err) {
      alert('Failed to create game: ' + err.message);
    }
  }
  
  // Join an existing game
  async joinGame() {
    const roomId = document.getElementById('roomIdInput').value.trim();
    if (!roomId) {
      alert('Please enter a valid Room ID');
      return;
    }
    
    try {
      await this.game.joinGame(roomId);
      this.roomId = roomId;
      this.isHost = false;
      
      // Update UI
      document.getElementById('roomInfo').textContent = `Joined Room: ${this.roomId}`;
      document.getElementById('joinControls').style.display = 'none';
    } catch (err) {
      alert('Failed to join game: ' + err.message);
    }
  }
  
  // Clean up resources
  destroy() {
    this.game.destroy();
    cancelAnimationFrame(this.animationFrame);
  }
  
  // Private methods
  _setupEventListeners() {
    // Handle mouse movements to control player
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.game.movePlayer(x, y);
    });
    
    // Handle clicks to create game objects
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.game.createGameObject('bullet', {
        x,
        y,
        radius: 5,
        speed: 5,
        direction: Math.random() * Math.PI * 2
      });
    });
  }
  
  _createUI() {
    // Create container for controls
    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginBottom = '10px';
    document.body.insertBefore(controlsDiv, this.canvas);
    
    // Host button
    const hostBtn = document.createElement('button');
    hostBtn.textContent = 'Host Game';
    hostBtn.onclick = () => this.createGame();
    controlsDiv.appendChild(hostBtn);
    
    // Join controls
    const joinControls = document.createElement('div');
    joinControls.id = 'joinControls';
    joinControls.style.display = 'inline-block';
    joinControls.style.marginLeft = '10px';
    
    const roomInput = document.createElement('input');
    roomInput.id = 'roomIdInput';
    roomInput.placeholder = 'Room ID';
    roomInput.style.marginRight = '5px';
    
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Join Game';
    joinBtn.onclick = () => this.joinGame();
    
    joinControls.appendChild(roomInput);
    joinControls.appendChild(joinBtn);
    controlsDiv.appendChild(joinControls);
    
    // Host-specific controls
    const hostControls = document.createElement('div');
    hostControls.id = 'hostControls';
    hostControls.style.display = 'none';
    
    // Room info display
    const roomInfo = document.createElement('div');
    roomInfo.id = 'roomInfo';
    roomInfo.style.marginTop = '5px';
    
    controlsDiv.appendChild(hostControls);
    controlsDiv.appendChild(roomInfo);
  }
  
  _startRenderLoop() {
    const render = () => {
      this._renderGame();
      this.animationFrame = requestAnimationFrame(render);
    };
    
    this.animationFrame = requestAnimationFrame(render);
  }
  
  _renderGame() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render players
    Object.entries(this.game.players).forEach(([playerId, player]) => {
      this.ctx.fillStyle = player.color || '#FF0000';
      this.ctx.beginPath();
      this.ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw player name
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(player.name, player.x, player.y - 25);
      
      // Highlight local player
      if (playerId === this.game.localPlayerId) {
        this.ctx.strokeStyle = '#FFFF00';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    });
    
    // Render game objects
    Object.entries(this.game.gameObjects).forEach(([objId, obj]) => {
      if (obj.type === 'bullet') {
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(obj.x, obj.y, obj.radius || 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Update bullet position (simplified - in a real game, this would be done in a game loop)
        if (this.isHost) {
          const newX = obj.x + Math.cos(obj.direction) * obj.speed;
          const newY = obj.y + Math.sin(obj.direction) * obj.speed;
          
          // Check if bullet is out of bounds
          if (newX < 0 || newX > this.canvas.width || 
              newY < 0 || newY > this.canvas.height) {
            // Remove bullet
            delete this.game.gameObjects[objId];
          } else {
            // Update position
            this.game.network.syncGameObject(objId, {
              x: newX,
              y: newY
            });
          }
        }
      }
    });
  }
}

// Initialize when the page loads
window.addEventListener('load', () => {
  const gameUI = new GameUI();
  gameUI.init();
  
  // Store instance for cleanup
  window.gameInstance = gameUI;
});
