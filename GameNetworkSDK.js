// GameNetworkSDK.js - Enhanced with matchmaking and voice chat

import MatchmakingService from './MatchmakingService.js';
import VoiceChatManager from './VoiceChatManager.js';

class GameNetworkSDK {
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
  async initAsHost(roomId = null, roomMetadata = {}) {
    this.isHost = true;
    const id = roomId || this._generateRoomId();
    
    try {
      return await new Promise((resolve, reject) => {
        this.peer = new Peer(id, this.options.peerOptions);
        
        this.peer.on('open', async (peerId) => {
          this.clientId = peerId;
          this.log(`Initialized as host with ID: ${peerId}`);
          
          // Register with matchmaking if enabled
          if (this.matchmaking) {
            try {
              await this.matchmaking.init(peerId);
              await this.matchmaking.registerRoom(peerId, roomMetadata);
            } catch (err) {
              this.log('Warning: Failed to register with matchmaking service', err);
              // Continue without matchmaking
            }
          }
          
          // Initialize voice chat if enabled
          if (this.voiceChat) {
            try {
              await this.voiceChat.init(this.peer);
            } catch (err) {
              this.log('Warning: Failed to initialize voice chat', err);
              // Continue without voice chat
            }
          }
          
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
  
  // Initialize as a client (connecting to a host)
  async joinRoom(hostId, password = null) {
    try {
      return await new Promise((resolve, reject) => {
        // Initialize peer without specific ID (random ID)
        this.peer = new Peer(this.options.peerOptions);
        
        this.peer.on('open', async (id) => {
          this.clientId = id;
          this.log(`Initialized as client with ID: ${id}`);
          
          // Initialize voice chat if enabled
          if (this.voiceChat) {
            try {
              await this.voiceChat.init(this.peer);
            } catch (err) {
              this.log('Warning: Failed to initialize voice chat', err);
              // Continue without voice chat
            }
          }
          
          // Connect to the host
          const conn = this.peer.connect(hostId, {
            reliable: true,
            metadata: { password }
          });
          
          conn.on('open', () => {
            this.log(`Connected to host: ${hostId}`);
            this.connections.set(hostId, conn);
            
            // Set up data reception
            this._setupDataHandling(conn);
            this._triggerEvent('connection', { peerId: hostId });
            
            // Connect to voice chat if enabled
            if (this.voiceChat) {
              this.voiceChat.callPeer(hostId).catch(err => {
                this.log('Warning: Failed to connect voice chat', err);
              });
            }
            
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
  
  // Find available game rooms (requires matchmaking)
  async findRooms(filters = {}) {
    if (!this.matchmaking) {
      throw new Error('Matchmaking service not enabled');
    }
    
    try {
      await this.matchmaking.refreshRooms();
      return this.matchmaking.findRooms(filters);
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to find rooms',
        error: err
      });
      return [];
    }
  }