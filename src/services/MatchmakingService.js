// Peer-to-Peer MatchmakingService using PeerJS
import PeerConnectionManager from '../modules/PeerConnectionManager.js';
 
class MatchmakingService {
  constructor({ game, connectionManager, playerId, ...options }) {
    this.options = {
      heartbeatInterval: 30000, // 30 seconds
      ...options
    };
    
    this.peerManager = new PeerConnectionManager();
    this.availableRooms = new Map(); // Using Map for better performance
    this.ownRoom = null;
    this.heartbeatTimer = null;
    this.clientId = playerId;
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
      await this.peerManager.createPeer(this.clientId);
      
      // Start listening for connections
      this.peerManager.onConnection((conn) => {
        // When a new peer connects, send them our room info if we're hosting
        console.log('[_init] new peer connected: ', conn);
        if (this.ownRoom) {
          this.peerManager.send(conn.peer, {
            type: 'roomUpdate',
            room: this.ownRoom
          });
        }
      });

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
  async registerRoom(roomId, metadata = {}) {
    if (!this.clientId) {
      throw new Error('Matchmaking service not initialized');
    }
    
    const roomData = {
      id: roomId,
      host: this.clientId,
      createdAt: new Date().toISOString(),
      players: 1,
      maxPlayers: metadata.maxPlayers || 8,
      gameName: metadata.gameName || 'Untitled Game',
      gameMode: metadata.gameMode || 'standard',
      isPrivate: metadata.isPrivate || false,
      hasPassword: !!metadata.password,
      region: metadata.region || this._detectRegion(),
      ...metadata
    };
    
    // Store password locally if provided
    if (metadata.password) {
      roomData.password = metadata.password;
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
    if (data.type === 'keyboardEvent') {
      console.log(`[KeyboardController] Received keyboard event from peer:`, data);
  
      // Prevent rebroadcasting our own events
      if (data.data.playerId === this.playerId) {
        console.log(`[KeyboardController] Ignoring self-broadcasted event: ${data.event}`);
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
          console.error('Error in event handler:', err);
        }
      });
    }
  }

  _broadcast(eventName, data) {
    console.log(`[MatchmakingService] Broadcasting: ${eventName}`, data);
    console.log(`[MatchmakingService] Broadcasting connectionManager: `, this.connectionManager);
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
        console.log(`[MatchmakingService] Broadcast successful.`);
      } catch (err) {
        this._triggerError('Broadcast failed', err);
      }
    } else {
      console.warn('[MatchmakingService] No peers to broadcast to.');
    }
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
