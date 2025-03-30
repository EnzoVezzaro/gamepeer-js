// Import the SDK
import { GameNetworkSDK } from './GameNetworkSDK.js';

class SimpleMultiplayerGame {
  constructor() {
    // Initialize the networking SDK
    this.network = new GameNetworkSDK({
      debug: true,
      tickRate: 30
    });
    
    // Game-specific state
    this.players = {};
    this.gameObjects = {};
    this.localPlayerId = null;
    
    // Set up network event handlers
    this._setupNetworkHandlers();
  }
  
  // Host a new game
  async hostGame() {
    try {
      const roomId = await this.network.initAsHost();
      console.log(`Game hosted with room ID: ${roomId}`);
      
      // Create local player
      this.localPlayerId = 'player_' + this.network.clientId;
      this._createLocalPlayer();
      
      return roomId;
    } catch (err) {
      console.error('Failed to host game:', err);
      throw err;
    }
  }
  
  // Join an existing game
  async joinGame(roomId) {
    try {
      await this.network.joinRoom(roomId);
      console.log(`Joined game with room ID: ${roomId}`);
      
      // Create local player after joining
      this.localPlayerId = 'player_' + this.network.clientId;
      this._createLocalPlayer();
      
      // Request full state from host
      this._requestFullState();
    } catch (err) {
      console.error('Failed to join game:', err);
      throw err;
    }
  }
  
  // Move the local player
  movePlayer(x, y) {
    if (!this.localPlayerId) return;
    
    // Update local state
    const player = this.players[this.localPlayerId];
    if (player) {
      player.x = x;
      player.y = y;
      
      // Sync with network
      this.network.syncGameObject(this.localPlayerId, { x, y });
    }
  }
  
  // Create a new game object
  createGameObject(type, props = {}) {
    const objectId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const gameObject = {
      type,
      ownerId: this.localPlayerId,
      ...props
    };
    
    // Add to local state
    this.gameObjects[objectId] = gameObject;
    
    // Sync with network
    this.network.syncGameObject(objectId, gameObject);
    
    return objectId;
  }
  
  // Clean up resources
  destroy() {
    this.network.disconnect();
  }
  
  // Private methods
  _setupNetworkHandlers() {
    // Handle new player connections
    this.network.on('connection', (data) => {
      console.log(`Player connected: ${data.peerId}`);
    });
    
    // Handle player disconnections
    this.network.on('disconnection', (data) => {
      console.log(`Player disconnected: ${data.peerId}`);
      
      // Remove player and their objects
      const playerId = `player_${data.peerId}`;
      delete this.players[playerId];
      
      // Remove game objects owned by the disconnected player
      Object.entries(this.gameObjects).forEach(([objId, obj]) => {
        if (obj.ownerId === playerId) {
          delete this.gameObjects[objId];
        }
      });
    });
    
    // Handle state updates from the network
    this.network.on('stateUpdate', (data) => {
      if (data.fullState) {
        // Full state update
        this._handleFullStateUpdate();
      } else {
        // Single object update
        this._handleObjectUpdate(data.objectId, data.data);
      }
    });
  }
  
  _createLocalPlayer() {
    const playerData = {
      name: `Player ${this.network.clientId.substr(0, 5)}`,
      x: Math.floor(Math.random() * 500),
      y: Math.floor(Math.random() * 500),
      color: this._getRandomColor()
    };
    
    // Add to local state
    this.players[this.localPlayerId] = playerData;
    
    // Sync with network
    this.network.syncGameObject(this.localPlayerId, playerData);
  }
  
  _handleObjectUpdate(objectId, data) {
    // Check if this is a player update
    if (objectId.startsWith('player_')) {
      if (!this.players[objectId]) {
        this.players[objectId] = data;
      } else {
        Object.assign(this.players[objectId], data);
      }
    } else {
      // Game object update
      if (!this.gameObjects[objectId]) {
        this.gameObjects[objectId] = data;
      } else {
        Object.assign(this.gameObjects[objectId], data);
      }
    }
  }
  
  _handleFullStateUpdate() {
    const state = this.network.gameState.getFullState();
    
    // Reset local collections
    this.players = {};
    this.gameObjects = {};
    
    // Process all objects from state
    Object.entries(state).forEach(([id, data]) => {
      if (id.startsWith('player_')) {
        this.players[id] = data;
      } else {
        this.gameObjects[id] = data;
      }
    });
  }
  
  _requestFullState() {
    // Find host connection and request full state
    this.network.connections.forEach((conn) => {
      conn.send({
        type: 'fullStateRequest'
      });
    });
  }
  
  _getRandomColor() {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Export the game class
export default SimpleMultiplayerGame;