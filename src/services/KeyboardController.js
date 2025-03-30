// KeyboardController.js - Tracks keyboard input states

export default class KeyboardController {
  constructor() {
    this.keyStates = new Map();
    this.customBindings = new Map();
    this.eventHandlers = {
      'keydown': [],
      'keyup': []
    };

    // Standard key bindings
    this.standardKeys = {
      'ArrowUp': 'UP',
      'ArrowDown': 'DOWN', 
      'ArrowLeft': 'LEFT',
      'ArrowRight': 'RIGHT',
      ' ': 'SPACE'
    };

    this._setupEventListeners();
  }

  // Add custom key binding
  addBinding(keyCode, actionName) {
    this.customBindings.set(keyCode, actionName);
  }

  // Check if a key/action is currently pressed
  isPressed(key) {
    return this.keyStates.get(key) || false;
  }

  // Register event handlers
  on(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(callback);
    }
  }

  // Private methods
  _setupEventListeners() {
    window.addEventListener('keydown', (e) => this._handleKeyDown(e));
    window.addEventListener('keyup', (e) => this._handleKeyUp(e));
  }

  _handleKeyDown(e) {
    const action = this._getActionForKey(e.code);
    if (!action) return;

    this.keyStates.set(action, true);
    this._triggerEvent('keydown', { action, event: e });
  }

  _handleKeyUp(e) {
    const action = this._getActionForKey(e.code);
    if (!action) return;

    this.keyStates.set(action, false);
    this._triggerEvent('keyup', { action, event: e });
  }

  _getActionForKey(keyCode) {
    return this.customBindings.get(keyCode) || 
           this.standardKeys[keyCode] || 
           keyCode;
  }

  _triggerEvent(event, data) {
    this.eventHandlers[event]?.forEach(handler => handler(data));
  }

  // Cleanup
  destroy() {
    window.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('keyup', this._handleKeyUp);
  }
}
