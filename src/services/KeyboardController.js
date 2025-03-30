// KeyboardController.js - Tracks keyboard input states

export default class KeyboardController {
  constructor(options = {}) {
    this.customBindings = new Map();
    this.eventHandlers = {
      'keydown': [],
      'keyup': [],
      'error': []
    };
    this.playerId = options.playerId;
    this.connectionManager = options.connectionManager;

    // Standard key bindings
    this.standardKeys = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      ' ': 'space',
      'Enter': 'enter'
    };

    // Set up custom bindings from options
    if (options.keybindings) {
      options.keybindings.forEach(([eventName, keyCode]) => {
        this.customBindings.set(keyCode, eventName);
      });
    }

    // initializing listeners
    console.log('initializing listeners keyboard service: ', this);
    this._setupEventListeners();
  }

  // Register event handlers
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    return this; // Enable method chaining
  }

  // Private methods
  _setupEventListeners() {
    try {
      // Use capturing phase to reliably intercept arrow keys
      console.log('[_setupEventListeners]');
      window.addEventListener('keydown', this._handleKeyDown.bind(this), true);
      window.addEventListener('keyup', this._handleKeyUp.bind(this));
    } catch (err) {
      this._triggerError('Failed to setup event listeners', err);
    }
  }

  _handleKeyDown(e) {
    try {
      console.log('press key: ', e);
      const action = this._getActionForKey(e.code);
      if (!action) return;

      // Block arrow keys from scrolling
      console.log('press key: 1');
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
      console.log('press key: 2');
      this._triggerEvent(action, {
        action: 'down',
        event: e
      });
      console.log('press key: 3');
      this._broadcast(action, {
        action: 'down',
        event: e
      });
      console.log('press key: 4');
    } catch (err) {
      this._triggerError('Key down error', err);
    }
  }

  _handleKeyUp(e) {
    console.log('press key: ', e);
    try {
      const action = this._getActionForKey(e.code);
      if (!action) return;

      this._triggerEvent(action, {
        action: 'up',
        event: e
      });
      this._broadcast(action, {
        action: 'up',
        event: e
      });
    } catch (err) {
      this._triggerError('Key up error', err);
    }
  }

  _getActionForKey(keyCode) {
    return this.customBindings.get(keyCode) || this.standardKeys[keyCode];
  }

  _broadcast(event, data) {
    console.log('press key: _broadcast', event, data, this.connectionManager);
    if (this.connectionManager) {
      this.connectionManager.broadcast({
        type: event,
        event,
        data: {
          ...data,
          playerId: this.playerId,
          timestamp: Date.now()
        }
      });
    }
  }

  _triggerEvent(event, data) {
    console.log('press key: _triggerEvent', event, data);
    this.eventHandlers[event]?.forEach(handler => handler(data));
  }

  _triggerError(message, error) {
    this.eventHandlers['error']?.forEach(handler => handler({message, error}));
  }

  destroy() {
    window.removeEventListener('keydown', this._handleKeyDown, true);
    window.removeEventListener('keyup', this._handleKeyUp);
  }
}
