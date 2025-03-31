// Peer-to-Peer MatchmakingService using PeerJS
import PeerConnectionManager from '../modules/PeerConnectionManager.js';
 
class MatchmakingService {
  constructor({ game, connectionManager, playerId, debug = false, ...options }) {
    this.options = {
      heartbeatInterval: 30000, // 30 seconds
      ...options
    };
    this.debug = debug;
    this.log = debug ? console.log.bind(console, '[MatchmakingService]') : () => {};
    this.scores = [0];
    this.players = 1;

    this.log('options match: ', options);
    
    this.gameName = options.gameName || 'Untitled Game';
    this.gameMode = options.gameMode || 'standard';
    this.isPrivate = options.isPrivate || false;
    this.hasPassword = options.hasPassword || false;
    this.region = options.region || this._detectRegion()
    this.maxPlayers = options.maxPlayers;

    this.peerManager = new PeerConnectionManager();
    this.availableRooms = new Map(); // Using Map for better performance
    this.ownRoom = null;
    this.heartbeatTimer = null;
    this.clientId = playerId;
    this.id = null;
    this.registerRoom = this.registerRoom;
    this.updateRoom = this.updateRoom;
    this.connectionManager = connectionManager;

    this._handleIncomingData = this._handleIncomingData.bind(this);
    
    this.eventHandlers = {
      'roomsUpdated': [],
      'error': []
    };

    // Setup peer data handler
    this.peerManager.on('data', ({ data }) => {
      if (data.type === 'roomUpdate') {
        this._handleRoomUpdate(data.room);
      }
    });

    this._init();
  }
  
  // Initialize with PeerJS connection
  async _init() {
    try {
      this.log('[_init] listening peers: ', this.clientId);
      await this.connectionManager.createPeer(this.clientId);
      this.addPlayer();

      if (this.connectionManager) {
        this.connectionManager.on('data', this._handleIncomingData);
      }
      
      // Start heartbeat for keeping room list updated
      this._startHeartbeat();
      
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to initialize matchmaking service',
        error: err
      });
      return false;
    }
  } 
  
  // Register a new game room
  async registerRoom(roomId) {
    if (!this.clientId) {
      throw new Error('Matchmaking service not initialized');
    }
    
    // Initialize scores array with host player
    this.scores = [0];
    this.players = 1;
    
    const roomData = {
      id: roomId,
      host: this.clientId,
      createdAt: new Date().toISOString(),
      players: this.players,
      maxPlayers: this.maxPlayers,
      gameName: this.gameName,
      gameMode: this.gameMode,
      isPrivate: this.isPrivate,
      hasPassword: this.hasPassword,
      region: this.region,
      scores: this.scores
    };

    this.log('initializing match: ', roomData);
    
    // Store password locally if provided
    if (this.password) {
      roomData.password = this.password;
    }
    
    this.ownRoom = roomData;
    this.availableRooms.set(roomId, roomData);
    
    this._triggerEvent('roomsUpdated', {
      rooms: Array.from(this.availableRooms.values())
    });
    
    return true;
  }
  
  // Update room information (player count, etc.)
  async updateRoom(updates = {}) {
    if (!this.ownRoom) {
      throw new Error('No room registered');
    }
    
    // Update local room data
    this.ownRoom = { ...this.ownRoom, ...updates };
    this.availableRooms.set(this.ownRoom.id, this.ownRoom);
    
    // Broadcast update to all connected peers
    this.peerManager.broadcast({
      type: 'roomUpdate',
      room: this.ownRoom
    });
    
    this._triggerEvent('roomsUpdated', {
      rooms: Array.from(this.availableRooms.values())
    });
    
    return true;
  }
  
  // Remove room from matchmaking
  async unregisterRoom() {
    if (!this.ownRoom) {
      return true; // Nothing to unregister
    }
    
    // Remove from local list
    this.availableRooms.delete(this.ownRoom.id);
    
    // Broadcast removal to all connected peers
    this.peerManager.broadcast({
      type: 'roomRemoval',
      roomId: this.ownRoom.id
    });
    
    this.ownRoom = null;
    
    this._triggerEvent('roomsUpdated', {
      rooms: Array.from(this.availableRooms.values())
    });
    
    return true;
  }
  
  // Get the latest list of available rooms
  async refreshRooms() {
    // In P2P mode, we don't need to actively refresh since updates come via broadcasts
    return Array.from(this.availableRooms.values());
  }
  
  // Find rooms matching specific criteria
  findRooms(filters = {}) {
    return Array.from(this.availableRooms.values()).filter(room => {
      // Apply all filters
      for (const [key, value] of Object.entries(filters)) {
        if (room[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  
  // Join a room with optional password
  async joinRoom(roomId, password = null) {
    const room = this.availableRooms.get(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (room.hasPassword && !password) {
      throw new Error('Password required');
    }
    
    // In P2P mode, the actual connection happens through PeerConnectionManager
    // This just returns the room info needed to connect
    return {
      id: room.id,
      host: room.host,
      password: password
    };
  }

  _handleIncomingData({ data }) {
    // Note: This log seems related to KeyboardController, might need adjustment there too.
    // For now, applying the MatchmakingService logger.
    if (data.type === 'keyboardEvent') {
      this.log(`Received keyboard event from peer:`, data);

      // Prevent rebroadcasting our own events
      if (data.data.playerId === this.playerId) {
        this.log(`Ignoring self-broadcasted event: ${data.event}`);
        return;
      }
  
      this._triggerEvent(data.event, data.data);
    }
  }
  
  // Handle incoming room updates from peers
  _handleRoomUpdate(roomData) {
    // Don't process our own room updates
    if (roomData.host === this.clientId) return;
    
    // Update or add the room
    this.availableRooms.set(roomData.id, roomData);
    
    this._triggerEvent('roomsUpdated', {
      rooms: Array.from(this.availableRooms.values())
    });
  }
  
  // Handle room removal notifications
  _handleRoomRemoval(roomId) {
    // Don't process our own room
    if (this.ownRoom?.id === roomId) return;
    
    this.availableRooms.delete(roomId);
    
    this._triggerEvent('roomsUpdated', {
      rooms: Array.from(this.availableRooms.values())
    });
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    return this;
  }
  
  // Remove event handlers
  off(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event]
        .filter(handler => handler !== callback);
    }
    return this;
  }
  
  // Clean up resources
  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Unregister room if we were hosting
    if (this.ownRoom) {
      this.unregisterRoom().catch(console.error);
    }

    if (this.connectionManager) {
      this.connectionManager.off('data', this._handleIncomingData);
    }
    
    this.peerManager.destroy();
  }
  
  // Private methods
  _startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      // In P2P mode, we don't need to actively refresh rooms
      // but we can use this to clean up stale rooms
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      for (const [roomId, room] of this.availableRooms) {
        const roomAge = now - new Date(room.createdAt).getTime();
        if (roomAge > staleThreshold && room.host !== this.clientId) {
          this.availableRooms.delete(roomId);
        }
      }
      
      this._triggerEvent('roomsUpdated', {
        rooms: Array.from(this.availableRooms.values())
      });
    }, this.options.heartbeatInterval);
  }
  
  _triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
          this._broadcast(event, data);
        } catch (err) {
          this.log('Error in event handler:', err); // Changed from console.error
        }
      });
    }
  }

  _broadcast(eventName, data) {
    this.log(`Broadcasting: ${eventName}`, data);
    this.log(`Broadcasting connectionManager: `, this.connectionManager);
    if (this.connectionManager && this.connectionManager.connections.size > 0) {
      const message = {
        type: 'roomsUpdated',
        event: eventName,
        data: {
          ...data,
          playerId: this.playerId,
          timestamp: Date.now(),
        },
      };
  
      try {
        this.connectionManager.broadcast(message);
        this.log(`Broadcast successful.`);
      } catch (err) {
        this._triggerError('Broadcast failed', err); // Assuming _triggerError handles logging/errors appropriately
      }
    } else {
      this.log('No peers to broadcast to.'); // Changed from console.warn
    }
  }
  
  // Add a new player and initialize their score
  addPlayer() {
    this.players++;
    this.scores.push(0); // Initialize new player's score to 0
    this.log('[addPlayer] players:', this.players, 'scores:', this.scores);
    // Update room with new player count and scores
    this.updateRoom({ 
      players: this.players,
      scores: this.scores
    });
    return this.players - 1; // Return player index
  }

  // Update a player's score and broadcast the update
  updateScore(playerIndex, increment = 1) {
    this.log('[updateScore] start:', playerIndex, increment, 'current scores:', this.scores);
    
    // Ensure scores array is properly initialized
    if (!this.scores || this.scores.length < this.players) {
      this.scores = Array(this.players).fill(0);
    }

    if (playerIndex >= 0 && playerIndex < this.scores.length) {
      // Atomic score update with synchronization
      const newScores = [...this.scores];
      newScores[playerIndex] += increment;
      
      // Update with timestamp to detect stale updates
      this.scores = newScores;
      this.updateRoom({ 
        scores: this.scores,
        lastUpdate: Date.now() 
      });
      
      this.log('[updateScore] success:', this.scores);
      return true;
    }
    
    this.log('[updateScore] invalid playerIndex:', playerIndex); // Changed from console.error
    return false;
  }

  // Get current scores
  getScores() {
    return this.scores;
  }

  _detectRegion() {
    // Simplified region detection based on timezone
    const timezoneOffset = new Date().getTimezoneOffset();
    
    if (timezoneOffset >= 240 && timezoneOffset <= 300) {
      return 'na-east'; // Eastern & Central North America
    } else if (timezoneOffset > 300 && timezoneOffset <= 480) {
      return 'na-west'; // Mountain & Pacific North America
    } else if (timezoneOffset >= -60 && timezoneOffset <= 60) {
      return 'eu'; // Europe
    } else if (timezoneOffset >= -660 && timezoneOffset <= -480) {
      return 'asia-pacific'; // Asia Pacific
    }
    
    return 'global'; // Default fallback
  }
}

export default MatchmakingService;
