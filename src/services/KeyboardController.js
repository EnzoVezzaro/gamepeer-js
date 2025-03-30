// KeyboardController.js - Tracks keyboard input states

export default class KeyboardController {
  constructor(options = {}) {
    this.keyStates = new Map();
    this.customBindings = new Map();
    this.eventHandlers = {
      'keydown': [],
      'keyup': [],
      'error': []
    };

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
      window.addEventListener('keydown', (e) => this._handleKeyDown(e));
      window.addEventListener('keyup', (e) => this._handleKeyUp(e));
    } catch (err) {
      this._triggerError('Failed to setup event listeners', err);
    }
  }

  _handleKeyDown(e) {
    try {
      const action = this._getActionForKey(e.code);
      if (!action) return;

      // Prevent default for arrow keys to avoid scrolling but allow event propagation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }

      this.keyStates.set(action, true);
      this._triggerEvent(action, { 
        action: 'down', 
        event: e 
      });
      this._broadcast(action, { 
        action: 'down', 
        event: e 
      });
    } catch (err) {
      this._triggerError('Key down error', err);
    }
  }

  _handleKeyUp(e) {
    try {
      const action = this._getActionForKey(e.code);
      if (!action) return;

      // Prevent default for arrow keys to avoid scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      this.keyStates.set(action, false);
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
    return this.customBindings.get(keyCode) || 
           this.standardKeys[keyCode];
  }

  _broadcast(event, data) {
    try {
      if (this.connectionManager) {
        this.connectionManager.broadcast({
          type: 'keyboardEvent',
          event,
          data
        });
      }
    } catch (err) {
      this._triggerError('Broadcast error', err);
    }
  }

  _triggerEvent(event, data) {
    this.eventHandlers[event]?.forEach(handler => handler(data));
  }

  _triggerError(message, error) {
    this.eventHandlers['error']?.forEach(handler => 
      handler({ message, error })
    );
  }

  // Cleanup
  destroy() {
    window.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('keyup', this._handleKeyUp);
  }
}
