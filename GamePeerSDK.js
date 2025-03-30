// GamePeerSDK.js - Browser-to-browser P2P game SDK using PeerJS

import MatchmakingService from './MatchmakingService.js';
import VoiceChatManager from './VoiceChatManager.js';

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
      ...options
    };
    
    this.peer = null;
    this.connections = new Map(); // Store active connections
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
  }
  
  // Initialize as a host (server)
  async hostGame(roomId = null, roomMetadata = {}) {
    this.isHost = true;
    const id = roomId || this._generateRoomId();
    
    try {
      return await new Promise((resolve, reject) => {
        this.peer = new Peer(id, this.options.peerOptions);
        
        this.peer.on('open', async (peerId) => {
          this.clientId = peerId;
          this.localPlayerId = `player_${peerId}`;
          this.log(`Initialized as host with ID: ${peerId}`);
          
          // Register with matchmaking if enabled
          if (this.matchmaking) {
            try {
              await this.matchmaking.init(peerId);
              await this.matchmaking.registerRoom(peerId, roomMetadata);
            } catch (err) {
              this.log('Warning: Failed to register with matchmaking service', err);
            }
          }
          
          // Initialize voice chat if enabled
          if (this.voiceChat) {
            try {
              await this.voiceChat.init(this.peer);
            } catch (err) {
              this.log('Warning: Failed to initialize voice chat', err);
            }
          }
          
          this._createLocalPlayer();
          this._startGameLoop();
          resolve(peerId);
        });
        
        this.peer.on('connection', (conn) => {
          this._handleNewConnection(conn);
        });
        
        this.peer.on('error', (err) => {
          this._triggerEvent('error', err);
          reject(err);
        });
      });
    } catch (err) {
      this._triggerEvent('error', err);
      throw err;
    }
  }
  
  // Join an existing game
  async joinGame(hostId) {
    try {
      return await new Promise((resolve, reject) => {
        this.peer = new Peer(this.options.peerOptions);
        
        this.peer.on('open', async (id) => {
          this.clientId = id;
          this.localPlayerId = `player_${id}`;
          this.log(`Initialized as client with ID: ${id}`);
          
          // Initialize voice chat if enabled
          if (this.voiceChat) {
            try {
              await this.voiceChat.init(this.peer);
            } catch (err) {
              this.log('Warning: Failed to initialize voice chat', err);
            }
          }
          
          // Connect to the host
          const conn = this.peer.connect(hostId, {
            reliable: true
          });
          
          conn.on('open', () => {
            this.log(`Connected to host: ${hostId}`);
            this.connections.set(hostId, conn);
            
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
            resolve(hostId);
          });
          
          conn.on('error', (err) => {
            this._triggerEvent('error', err);
            reject(err);
          });
        });
        
        this.peer.on('error', (err) => {
          this._triggerEvent('error', err);
          reject(err);
        });
      });
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
    if (this.peer) this.peer.destroy();
    if (this.voiceChat) this.voiceChat.destroy();
  }
  
  // Private methods
  _createLocalPlayer() {
    const playerData = {
      name: `Player ${this.clientId.substr(0, 5)}`,
      x: Math.floor(Math.random() * 500),
      y: Math.floor(Math.random() * 500),
      color: this._getRandomColor()
    };
    
    this.players[this.localPlayerId] = playerData;
    this.syncGameObject(this.localPlayerId, playerData);
  }
  
  _getRandomColor() {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // ... (rest of the GameNetworkSDK implementation)
}

// Helper class for game state management
class GameState {
  constructor() {
    this.state = {};
  }
  
  set(key, value) {
    this.state[key] = value;
  }
  
  get(key) {
    return this.state[key];
  }
  
  getFullState() {
    return this.state;
  }
  
  updateState(updates) {
    Object.assign(this.state, updates);
  }
}

export default GamePeerSDK;
