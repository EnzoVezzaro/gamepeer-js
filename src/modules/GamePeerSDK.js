// GamePeerSDK.js - Browser-to-browser P2P game SDK using PeerJS

import MatchmakingService from '../services/MatchmakingService.js';
import VoiceChatManager from '../services/VoiceChatManager.js';
import KeyboardController from '../services/KeyboardController.js';
import GameState from './GameState.js';
import PeerConnectionManager from './PeerConnectionManager.js';

// Load PeerJS dynamically from CDN
function loadPeerJS() {
  return new Promise((resolve) => {
    if (window.Peer) {
      return resolve();
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.4.7/peerjs.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

class GamePeerSDK {
  constructor(options = {}) {
    this.options = {
      debug: false,
      tickRate: 20, // Updates per second
      peerOptions: {}, // PeerJS specific options
      useMatchmaking: false,
      matchmakingOptions: {},
      useVoiceChat: false,
      voiceChatOptions: {},
      useKeyboardController: false,
      ...options
    };

    this._setupLogger = () => {
      this.log = this.options.debug 
        ? console.log.bind(console, '[GamePeerSDK]')
        : () => {};
    };
    
    this.connectionManager = new PeerConnectionManager(this.options.peerOptions);
    this.gameState = new GameState();
    this.isHost = false;
    this.clientId = null;
    this.lastUpdateTime = 0;
    this.tickInterval = null;
    
    // Game state
    this.players = {};
    this.gameObjects = {};
    this.localPlayerId = null;
    
    // Matchmaking and voice chat managers
    this.matchmaking = null;
    this.voiceChat = null;
    
    this.eventHandlers = {
      'connection': [],
      'disconnection': [],
      'stateUpdate': [],
      'error': [],
      'roomsUpdated': [],
      'voiceChatConnected': [],
      'voiceChatDisconnected': []
    };
    
    this._setupLogger();
    
    // Initialize optional services
    if (this.options.useMatchmaking) {
      this._initMatchmaking();
    }
    
    if (this.options.useVoiceChat) {
      this._initVoiceChat();
    }

    if (this.options.useKeyboardController) {
      this.keyboardController = new KeyboardController();
    }
  }
  
  // Initialize as a host (server)
  async hostGame(roomId = null, roomMetadata = {}) {
    await loadPeerJS();
    this.isHost = true;
    const id = roomId || this._generateRoomId();
    
    try {
      this.clientId = await this.connectionManager.createPeer(id);
      this.localPlayerId = `player_${this.clientId}`;
      this.log(`Initialized as host with ID: ${this.clientId}`);
      
      // Register with matchmaking if enabled
      if (this.matchmaking) {
        try {
          await this.matchmaking.init(this.clientId);
          await this.matchmaking.registerRoom(this.clientId, roomMetadata);
        } catch (err) {
          this.log('Warning: Failed to register with matchmaking service', err);
        }
      }
      
      // Initialize voice chat if enabled
      if (this.voiceChat) {
        try {
          await this.voiceChat.init(this.connectionManager.peer);
        } catch (err) {
          this.log('Warning: Failed to initialize voice chat', err);
        }
      }
      
      this.connectionManager.onConnection((peerId) => {
        this._handleNewConnection(peerId);
      });
      
      this._createLocalPlayer();
      this._startGameLoop();
      
      return this.clientId;
    } catch (err) {
      this._triggerEvent('error', err);
      throw err;
    }
  }
  
  // Join an existing game
  async joinGame(hostId) {
    await loadPeerJS();
    try {
      this.clientId = await this.connectionManager.createPeer();
      this.localPlayerId = `player_${this.clientId}`;
      this.log(`Initialized as client with ID: ${this.clientId}`);
      
      // Initialize voice chat if enabled
      if (this.voiceChat) {
        try {
          await this.voiceChat.init(this.connectionManager.peer);
        } catch (err) {
          this.log('Warning: Failed to initialize voice chat', err);
        }
      }
      
      // Connect to the host
      const conn = await this.connectionManager.connect(hostId, {
        reliable: true
      });
      
      this.log(`Connected to host: ${hostId}`);
      this._setupDataHandling(conn);
      this._triggerEvent('connection', { peerId: hostId });
      
      // Connect to voice chat if enabled
      if (this.voiceChat) {
        this.voiceChat.callPeer(hostId).catch(err => {
          this.log('Warning: Failed to connect voice chat', err);
        });
      }
      
      this._createLocalPlayer();
      this._requestFullState();
      
      return hostId;
    } catch (err) {
      this._triggerEvent('error', err);
      throw err;
    }
  }
  
  // Game object management
  createGameObject(type, props = {}) {
    const objectId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const gameObject = {
      type,
      ownerId: this.localPlayerId,
      ...props
    };
    
    this.gameObjects[objectId] = gameObject;
    this.syncGameObject(objectId, gameObject);
    return objectId;
  }
  
  syncGameObject(objectId, data) {
    if (!this.connectionManager.peer) return;
    
    // Update local state
    if (objectId.startsWith('player_')) {
      if (!this.players[objectId]) {
        this.players[objectId] = data;
      } else {
        Object.assign(this.players[objectId], data);
      }
    } else {
      if (!this.gameObjects[objectId]) {
        this.gameObjects[objectId] = data;
      } else {
        Object.assign(this.gameObjects[objectId], data);
      }
    }
    
    // Send update to all connections
    this.connectionManager.broadcast({
      type: 'stateUpdate',
      objectId,
      data
    });
    
    this.log(`Synced ${objectId}:`, data);
  }

  movePlayer(x, y) {
    if (!this.localPlayerId) return;
    
    const player = this.players[this.localPlayerId];
    if (player) {
      player.x = x;
      player.y = y;
      this.syncGameObject(this.localPlayerId, { x, y });
    }
  }
  
  // Clean up resources
  destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.connectionManager.destroy();
    if (this.voiceChat) this.voiceChat.destroy();
    if (this.keyboardController) this.keyboardController.destroy();
  }
  
  // Private methods
  _createLocalPlayer() {
    const playerData = {
      name: `Player ${this.clientId.substr(0, 5)}`,
      x: Math.floor(Math.random() * 500),
      y: Math.floor(Math.random() * 500),
      color: this._getRandomColor(),
      id: this.localPlayerId
    };
    
    this.players[this.localPlayerId] = playerData;
    // Force full sync of all player properties
    this.syncGameObject(this.localPlayerId, {
      ...playerData,
      syncAll: true
    });
  }
  
  _getRandomColor() {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  _initMatchmaking() {
    this.matchmaking = new MatchmakingService(this.options.matchmakingOptions);
    this.matchmaking.on('roomsUpdated', (rooms) => {
      this._triggerEvent('roomsUpdated', rooms);
    });
  }

  _initVoiceChat() {
    this.voiceChat = new VoiceChatManager(this.options.voiceChatOptions);
    this.voiceChat.on('connected', (peerId) => {
      this._triggerEvent('voiceChatConnected', { peerId });
    });
    this.voiceChat.on('disconnected', (peerId) => {
      this._triggerEvent('voiceChatDisconnected', { peerId });
    });
  }

  _generateRoomId() {
    return Math.random().toString(36).substr(2, 8);
  }

  _handleNewConnection(peerId) {
    this._setupDataHandling();
    this._triggerEvent('connection', { peerId });
  }

  on(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(handler);
    return this;
  }

  off(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(
        h => h !== handler
      );
    }
    return this;
  }

  _triggerEvent(eventName, data) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(handler => handler(data));
    }
  }

  _setupDataHandling() {
    this.connectionManager.on('data', ({data}) => {
      if (data?.type === 'stateUpdate' && data?.objectId) {
        this.log(`Received state update for ${data.objectId}`);
        
        // Update local state
        if (data.objectId.startsWith('player_')) {
          this.log(`Updating player ${data.objectId} with:`, data.data);
          if (!this.players[data.objectId]) {
            this.players[data.objectId] = {
              name: `Player ${data.objectId.substr(7, 5)}`,
              x: 0,
              y: 0,
              color: this._getRandomColor(),
              ...data.data
            };
          } else {
            // Preserve existing color if not in update
            const currentColor = this.players[data.objectId].color;
            this.players[data.objectId] = {
              ...this.players[data.objectId],
              ...data.data,
              color: data.data.color || currentColor
            };
          }
        } else {
          this.log(`Updating object ${data.objectId} with:`, data.data);
          if (!this.gameObjects[data.objectId]) {
            this.gameObjects[data.objectId] = data.data;
          } else {
            Object.assign(this.gameObjects[data.objectId], data.data);
          }
        }
        
        this._triggerEvent('stateUpdate', data);
      }
    });

    this.connectionManager.on('disconnection', ({peerId}) => {
      this._triggerEvent('disconnection', { peerId });
    });
  }

  _startGameLoop() {
    this.tickInterval = setInterval(() => {
      if (this.isHost) {
        // Sync game state with all connected peers
        this.connectionManager.broadcast({
          type: 'stateUpdate',
          data: this.gameState.getFullState()
        });
      }
    }, 1000 / this.options.tickRate);
  }

  _requestFullState() {
    this.connectionManager.broadcast({
      type: 'fullStateRequest'
    });
  }
}

export default GamePeerSDK;
