# GamePeerSDK - Peer-to-Peer Game SDK

## Project Structure
```
gamepeer-sdk/
├── src/
│   ├── modules/       # Core game modules
│   │   ├── GamePeerSDK.js   # Main SDK class
│   │   └── GameState.js     # Game state management  
│   │
│   └── services/      # Optional services
│       ├── MatchmakingService.js
│       └── VoiceChatManager.js
│
├── index.html         # Demo implementation
└── README.md          # Documentation
```

## Key Features

- **Host/Join Games**: Create or join game sessions with room IDs
- **Game State Sync**: Automatic synchronization of game objects and players
- **Matchmaking**: Optional matchmaking service integration
- **Voice Chat**: Optional voice chat functionality
- **No Server Required**: Pure P2P architecture

## Installation

Just include the SDK in your HTML - PeerJS will be loaded automatically when needed:
```html
<script type="module" src="GamePeerSDK.js"></script>
```

## Basic Usage

```javascript
// Initialize the SDK
const game = new GamePeerSDK({
  debug: true, // Enable debug logging
  tickRate: 20 // Network updates per second
});

// Host a game
async function hostGame() {
  const roomId = await game.hostGame();
  console.log('Hosting game with ID:', roomId);
}

// Join a game
async function joinGame(roomId) {
  await game.joinGame(roomId);
  console.log('Joined game:', roomId);
}

// Create game objects
function createBullet(x, y) {
  game.createGameObject('bullet', {
    x, y,
    radius: 5,
    speed: 5,
    direction: Math.random() * Math.PI * 2
  });
}

// Move player
function movePlayer(x, y) {
  game.movePlayer(x, y);
}

// Clean up
function destroy() {
  game.destroy();
}
```

## API Reference

### `new GamePeerSDK(options)`
Creates a new SDK instance.

**Options:**
- `debug` (Boolean): Enable debug logging
- `tickRate` (Number): Network updates per second
- `useMatchmaking` (Boolean): Enable matchmaking service
- `useVoiceChat` (Boolean): Enable voice chat

### Methods
- `hostGame(roomId, metadata)` - Host a new game session
- `joinGame(roomId)` - Join an existing game
- `createGameObject(type, properties)` - Create a new game object
- `movePlayer(x, y)` - Move the local player
- `destroy()` - Clean up resources

## Examples

See `index.html` for a complete implementation example.
