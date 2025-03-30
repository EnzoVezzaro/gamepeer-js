# GamePeerJS - Browser-to-Browser P2P Game SDK

GamePeerJS enables real-time multiplayer gaming directly between browsers using WebRTC. It provides:

- Peer-to-peer networking
- Input controllers (keyboard/mouse)
- Game state synchronization
- Matchmaking system
- Event system

## Installation

```bash
npm install gamepeer-js
```

## Initialization

```javascript
const game = new GamePeerJS({
  debug: false, // Enable debug logging (default: false)
  useKeyboardController: false, // Enable keyboard input (default: false)
  useMouseController: false, // Enable mouse input (default: false)
  useMatchmaking: false, // Enable matchmaking (default: false)
  useVoiceChat: false, // Enable voice chat (default: false)
  tickRate: 20, // Game state updates per second (default: 20)
  localPlayerId: `player-${Math.random().toString(36).substr(2, 8)}` // Auto-generated if not provided
});
```

## Core Game Functions

### Host a Game
```javascript
const roomId = await game.hostGame(); 
// Returns room ID to share with other players
```

### Join a Game
```javascript
const result = await game.joinGame(roomId);
// Returns "success" or throws error on failure
```

### Event System
```javascript
// Listen to custom events
game.on('playerJoined', (data) => {
  console.log('Player joined:', data);
});

// System events (always available)
game.on('stateUpdate', (data) => {
  // Handle game state updates
});

// Broadcast events to all players
game.broadcastEvent('bulletFired', {
  x: 100,
  y: 200
});
```

### Game Objects
```javascript
// Create a game object
const objId = game.createGameObject('bullet', {
  x: 100,
  y: 200,
  velocity: 5
});

// Sync object state
game.syncGameObject(objId, {
  x: 105, // New position
  y: 200
});
```

## Input Controllers

### Keyboard Controller
```javascript
// Only available if useKeyboardController: true
const keyboard = game.keyboardController({
  keybindings: [ // Optional custom bindings
    ['shoot', 'Space'],
    ['jump', 'KeyW'] 
  ]
});

// Listen to key events
keyboard.on('shoot', ({action, event}) => {
  // action: 'down' or 'up'
  // event: KeyboardEvent
});

// Default bindings (always available):
// 'up' - ArrowUp
// 'down' - ArrowDown
// 'left' - ArrowLeft
// 'right' - ArrowRight
// 'space' - Space
// 'enter' - Enter
keyboard.on('up', ({action}) => {
  // ArrowUp key pressed/released
});

// Error handling
keyboard.on('error', ({message, error}) => {
  console.error('Keyboard error:', message, error);
});
```

### Mouse Controller
```javascript
// Only available if useMouseController: true 
const mouse = game.mouseController({
  keybindings: [ // Optional custom bindings
    ['shoot', 'left click'],
    ['grenade', 'right click']
  ]
});

// Listen to mouse events
mouse.on('shoot', ({action, event}) => {
  // action: 'down' or 'up'
  // event: MouseEvent
});

// Default events (always available):
// 'mousemove' - Mouse movement
// 'mousedown' - Any mouse button down
// 'mouseup' - Any mouse button up
// 'click' - Left click
// 'rightclick' - Right click
mouse.on('mousemove', ({x, y}) => {
  // Mouse moved to (x,y)
});

// Error handling  
mouse.on('error', ({message, error}) => {
  console.error('Mouse error:', message, error);
});
```

## Matchmaking System

```javascript
const matchmaking = game.matchmaking({
  // Optional configuration
  heartbeatInterval: 30000, // Room list refresh in ms (default: 30000)
  
  // Room metadata defaults (can be overridden when registering)
  maxPlayers: 8, // Default max players per room
  gameName: 'Untitled Game', // Default game name
  gameMode: 'standard' // Default game mode
});

// Initialize with unique client ID
await matchmaking.init(clientId);

// Register Room (public - no password)
await matchmaking.registerRoom(roomId, {
  maxPlayers: 4
});

// Or register private room with password
await matchmaking.registerRoom(roomId, {
  maxPlayers: 4,
  password: 'secret' // Makes room private
});

// Get all rooms
const rooms = await matchmaking.refreshRooms();

// Filter rooms
const filteredRooms = matchmaking.findRooms({
  maxPlayers: 2
});

// Join Room (no password needed for public rooms)
const publicRoomInfo = await matchmaking.joinRoom(publicRoomId);

// Join private room (password required)
const privateRoomInfo = await matchmaking.joinRoom(privateRoomId, 'password');

// Listen to room updates
matchmaking.on('roomsUpdated', ({rooms}) => {
  console.log('Rooms updated:', rooms);
});

// Clean up
matchmaking.destroy();
```

## Cleanup

```javascript
// Properly clean up resources
game.destroy();
```

## Examples

See the `/examples` directory for complete usage examples.

## License

MIT
