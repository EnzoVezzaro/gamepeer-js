export default class KeyboardController {
  constructor({ game, connectionManager, playerId, ...options }) {
    this.customBindings = new Map();
    this.eventHandlers = {
      'up': [], 'down': [], 'left': [], 'right': [],
      'space': [], 'enter': [], 'keydown': [], 'keyup': [],
      'error': []
    };
    this.game = game;
    this.connectionManager = connectionManager;
    this.playerId = playerId;

    this.standardKeys = {
      'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left',
      'ArrowRight': 'right', ' ': 'space', 'Enter': 'enter'
    };

    if (options.keybindings) {
      options.keybindings.forEach(([eventName, keyCode]) => {
        this.customBindings.set(keyCode, eventName);
      });
    }

    // Bind event handlers
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this._handleIncomingData = this._handleIncomingData.bind(this);

    console.log(`[KeyboardController] Initializing with playerId: ${this.playerId}`);

    this._setupEventListeners();
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    return this;
  }

  _setupEventListeners() {
    try {
      window.addEventListener('keydown', this._handleKeyDown, true);
      window.addEventListener('keyup', this._handleKeyUp, true);

      if (this.connectionManager) {
        this.connectionManager.on('data', this._handleIncomingData);
      }

      console.log('[KeyboardController] Event listeners registered successfully.');
    } catch (err) {
      this._triggerError('Failed to setup event listeners', err);
    }
  }

  _handleKeyDown(e) {
    console.log(`[KeyboardController] Key Down: ${e.code}`);
    const action = this._getActionForKey(e.code);
    if (!action) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    const data = {
      action: 'down', key: e.code, keyName: action,
      altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey
    };

    console.log(`[KeyboardController] Triggering action: ${action}`, data);

    // this._triggerEvent(action, data);
    // this._triggerEvent('keydown', data);
  }

  _handleKeyUp(e) {
    console.log(`[KeyboardController] Key Up: ${e.code}`);
    const action = this._getActionForKey(e.code);
    if (!action) return;

    const data = {
      action: 'up', 
      key: e.code, 
      keyName: action,
      altKey: e.altKey, 
      ctrlKey: e.ctrlKey, 
      shiftKey: e.shiftKey,
      playerId: this.playerId
    };

    console.log(`[KeyboardController] Releasing action: ${action}`, data);

    this._triggerEvent(action, data);
    // this._triggerEvent('keyup', data);
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

  _getActionForKey(keyCode) {
    return this.customBindings.get(keyCode) || this.standardKeys[keyCode];
  }

  _broadcast(eventName, data) {
    console.log(`[KeyboardController] Broadcasting: ${eventName}`, data);
  
    if (this.connectionManager && this.connectionManager.connections.size > 0) {
      const message = {
        type: 'keyboardEvent',
        event: eventName,
        data: {
          ...data,
          playerId: this.playerId,
          timestamp: Date.now(),
        },
      };
  
      try {
        this.connectionManager.broadcast(message);
        console.log(`[KeyboardController] Broadcast successful.`);
      } catch (err) {
        this._triggerError('Broadcast failed', err);
      }
    } else {
      console.warn('[KeyboardController] No peers to broadcast to.');
    }
  }

  _triggerEvent(eventName, data) {
    console.log(`[KeyboardController] Dispatching event: ${eventName}`, data);

    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(handler => handler(data));
    }
    if (data.playerId === this.game.localPlayerId) {
      console.log(`[_triggerEvent] Ignoring self-broadcasted event: ${data.event}`);
      this._broadcast(eventName, data);
    }
  }

  _triggerError(message, error) {
    console.error(`[KeyboardController] Error: ${message}`, error);
    if (this.eventHandlers['error']) {
      this.eventHandlers['error'].forEach(handler => handler({ message, error }));
    }
  }

  destroy() {
    try {
      window.removeEventListener('keydown', this._handleKeyDown, true);
      window.removeEventListener('keyup', this._handleKeyUp, true);

      if (this.connectionManager) {
        this.connectionManager.off('data', this._handleIncomingData);
      }

      console.log('[KeyboardController] Destroyed successfully.');
    } catch (err) {
      console.error('[KeyboardController] Error during destroy:', err);
    }
  }
}
