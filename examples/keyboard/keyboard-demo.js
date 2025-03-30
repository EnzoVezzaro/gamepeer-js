// Keyboard Control Demo
document.addEventListener('DOMContentLoaded', () => {
  new KeyboardDemo();
});

class KeyboardDemo {
  constructor() {
    this.game = new GamePeerJS({
      debug: true,
      useKeyboardController: true,
      localPlayerId: 'keyboard-demo-player'
    });
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 600;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    // Player state
    this.player = {
      x: 400,
      y: 300,
      size: 30,
      color: '#0095DD'
    };

    // Setup controls
    this._setupCanvas();
    this._setupControls();
    this._startGameLoop();
  }

  _setupCanvas() {
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.style.outline = 'none';
    
    // Visual focus indicators
    this.canvas.addEventListener('focus', () => {
      this.canvas.style.boxShadow = '0 0 10px #00ff00';
    });
    this.canvas.addEventListener('blur', () => {
      this.canvas.style.boxShadow = 'none';
    });
    
    // Auto-focus after a delay
    setTimeout(() => this.canvas.focus(), 100);
  }

  _setupControls() {
    // Movement controls
    this.keyActions = {
      'UP': () => this.player.y -= 5,
      'DOWN': () => this.player.y += 5,
      'LEFT': () => this.player.x -= 5,
      'RIGHT': () => this.player.x += 5,
      'SPACE': () => this._jump()
    };

    // Prevent default for arrow keys and space
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    // Subscribe to keyboard events
    this.game.keyboardController.on('keydown', ({action, event}) => {
      const handler = this.keyActions[action];
      if (handler) {
        handler();
        this.syncPlayerPosition();
      }
    });
  }

  syncPlayerPosition() {
    this.game.syncGameObject(`player_${this.game.localPlayerId}`, {
      x: this.player.x,
      y: this.player.y
    });
  }

  _jump() {
    // Simple jump animation
    this.player.y -= 15;
    setTimeout(() => this.player.y += 15, 200);
  }

  _startGameLoop() {
    const loop = () => {
      this._draw();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw player
    this.ctx.fillStyle = this.player.color;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, this.player.size, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw instructions
    this.ctx.fillStyle = '#000';
    this.ctx.font = '18px Arial';
    this.ctx.fillText('Use arrow keys to move', 20, 30);
    this.ctx.fillText('Space to jump', 20, 60);
    this.ctx.fillText('Click canvas to focus', 20, 90);
  }
}
