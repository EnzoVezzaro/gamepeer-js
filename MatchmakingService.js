// MatchmakingService.js

class MatchmakingService {
  constructor(options = {}) {
    this.options = {
      serverUrl: 'https://your-matchmaking-server.com', // Replace with actual server
      heartbeatInterval: 30000, // 30 seconds
      ...options
    };
    
    this.availableRooms = [];
    this.ownRoom = null;
    this.heartbeatTimer = null;
    this.clientId = null;
    
    this.eventHandlers = {
      'roomsUpdated': [],
      'error': []
    };
  }
  
  // Initialize the matchmaking service
  async init(clientId) {
    this.clientId = clientId;
    
    try {
      // Initial fetch of available rooms
      await this.refreshRooms();
      
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
  
  // Register a new game room with the matchmaking service
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
    
    // Remove sensitive data
    if (roomData.password) {
      // Store password locally but don't send it to server
      const password = roomData.password;
      delete roomData.password;
      this.ownRoom = { ...roomData, password };
    } else {
      this.ownRoom = roomData;
    }
    
    try {
      const response = await fetch(`${this.options.serverUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(roomData)
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      console.log('Room registered with matchmaking service');
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to register room',
        error: err
      });
      return false;
    }
  }
  
  // Update room information (player count, etc.)
  async updateRoom(updates = {}) {
    if (!this.ownRoom) {
      throw new Error('No room registered');
    }
    
    const updatedData = {
      ...updates,
      id: this.ownRoom.id,
      host: this.clientId
    };
    
    try {
      const response = await fetch(`${this.options.serverUrl}/rooms/${this.ownRoom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      // Update local room data
      this.ownRoom = { ...this.ownRoom, ...updates };
      
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to update room',
        error: err
      });
      return false;
    }
  }
  
  // Remove room from matchmaking service
  async unregisterRoom() {
    if (!this.ownRoom) {
      return true; // Nothing to unregister
    }
    
    try {
      const response = await fetch(`${this.options.serverUrl}/rooms/${this.ownRoom.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ host: this.clientId })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      this.ownRoom = null;
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to unregister room',
        error: err
      });
      return false;
    }
  }
  
  // Get the latest list of available rooms
  async refreshRooms() {
    try {
      const response = await fetch(`${this.options.serverUrl}/rooms`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      this.availableRooms = data.rooms || [];
      
      this._triggerEvent('roomsUpdated', {
        rooms: this.availableRooms
      });
      
      return this.availableRooms;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to fetch available rooms',
        error: err
      });
      return [];
    }
  }
  
  // Find rooms matching specific criteria
  findRooms(filters = {}) {
    return this.availableRooms.filter(room => {
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
    const room = this.availableRooms.find(r => r.id === roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (room.hasPassword && !password) {
      throw new Error('Password required');
    }
    
    // We don't actually validate the password here - that would happen when
    // connecting to the host using PeerJS. This is just for UI flow.
    
    // Update player count on the server
    try {
      await fetch(`${this.options.serverUrl}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: this.clientId
        })
      });
      
      return {
        id: room.id,
        host: room.host,
        password: password
      };
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to join room',
        error: err
      });
      throw err;
    }
  }
  
  // Register event handlers
  on(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(callback);
    }
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
  }
  
  // Private methods
  _startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      // Refresh room list
      this.refreshRooms().catch(console.error);
      
      // Update our own room data if we're hosting
      if (this.ownRoom) {
        this.updateRoom().catch(console.error);
      }
    }, this.options.heartbeatInterval);
  }
  
  _triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error('Error in event handler:', err);
        }
      });
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