export default class KeyboardController {
  constructor({ game, connectionManager, playerId, debug = false, ...options }) {
    this.debug = debug;
    this.log = debug ? console.log.bind(console, '[KeyboardController]') : () => {};
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

    this.log(`Initializing with playerId: ${this.playerId}`);

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

      this.log('Event listeners registered successfully.');
    } catch (err) {
      this._triggerError('Failed to setup event listeners', err); // Keep _triggerError for now
    }
  }

  _handleKeyDown(e) {
    this.log(`Key Down: ${e.code}`);
    const action = this._getActionForKey(e.code);
    if (!action) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    const data = {
      action: 'down', key: e.code, keyName: action,
      altKey: e.altKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey
    };

    this.log(`Triggering action: ${action}`, data);

    // this._triggerEvent(action, data);
    // this._triggerEvent('keydown', data);
  }

  _handleKeyUp(e) {
    this.log(`Key Up: ${e.code}`);
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

    this.log(`Releasing action: ${action}`, data);

    this._triggerEvent(action, data);
    // this._triggerEvent('keyup', data);
  }

  _handleIncomingData({ data }) {
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

  _getActionForKey(keyCode) {
    return this.customBindings.get(keyCode) || this.standardKeys[keyCode];
  }

  _broadcast(eventName, data) {
    this.log(`Broadcasting: ${eventName}`, data);
  
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
        this.log(`Broadcast successful.`);
      } catch (err) {
        this._triggerError('Broadcast failed', err); // Keep _triggerError
      }
    } else {
      this.log('No peers to broadcast to.'); // Changed from console.warn
    }
  }

  _triggerEvent(eventName, data) {
    this.log(`Dispatching event: ${eventName}`, data);

    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(handler => handler(data));
    }
    if (data.playerId === this.game.localPlayerId) {
      this.log(`Ignoring self-broadcasted event: ${data.event}`);
      this._broadcast(eventName, data);
    }
  }

  // Keep _triggerError using console.error for actual errors
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

      this.log('Destroyed successfully.');
    } catch (err) {
      console.error('[KeyboardController] Error during destroy:', err); // Keep console.error
    }
  }
}
