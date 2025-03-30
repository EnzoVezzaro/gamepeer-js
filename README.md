# GamePeerJS - Peer-to-Peer Game SDK

## Features

- **Host/Join Games**: Create or join game sessions with room IDs
- **Game State Sync**: Automatic synchronization of game objects  
- **Keyboard Controls**: Built-in keyboard input tracking
- **Matchmaking**: Optional matchmaking service
- **Voice Chat**: Optional voice chat functionality
- **No Server Required**: Pure P2P architecture

## Keyboard Controls

The SDK includes built-in keyboard input handling:

```javascript
// Initialize with keyboard controls enabled
const game = new GamePeerJS({
  useKeyboardControls: true // Enabled by default
});

// Add custom key bindings (WASD + Space example)
game.addKeyBinding('KeyW', 'UP');
game.addKeyBinding('KeyS', 'DOWN');
game.addKeyBinding('KeyA', 'LEFT');
game.addKeyBinding('KeyD', 'RIGHT'); 
game.addKeyBinding('Space', 'SHOOT');

// Check key states
game.isKeyPressed('UP'); // Returns true if UP key is pressed

// Handle key events
game.on('keydown', ({action}) => {
  const player = game.players[game.localPlayerId];
  
  switch(action) {
    case 'UP': player.y -= 10; break;
    case 'DOWN': player.y += 10; break;
    case 'LEFT': player.x -= 10; break;
    case 'RIGHT': player.x += 10; break;
    case 'SHOOT': 
      game.createGameObject('bullet', {
        x: player.x, y: player.y
      });
      break;
  }
  
  game.syncGameObject(game.localPlayerId, {
    x: player.x,
    y: player.y
  });
});
```

Standard bindings are provided for:
- Arrow keys: UP, DOWN, LEFT, RIGHT
- Space: Shoot

## Installation & Basic Usage

[Previous installation/usage content...]
