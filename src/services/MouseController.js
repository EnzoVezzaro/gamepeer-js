// MouseController.js - Tracks and broadcasts mouse input
export default class MouseController {
  constructor(options = {}) {
    this.connectionManager = options.connectionManager;
    this.x = 0;
    this.y = 0;
    this.isDown = false;
    
    // Default bindings
    this.defaultEvents = ['mousemove', 'mousedown', 'mouseup', 'click', 'rightclick'];
    this.customBindings = new Map();
    
    this.eventHandlers = {
      ...Object.fromEntries(this.defaultEvents.map(e => [e, []])),
      'error': []
    };
  }

  setup(element) {
    try {
      this.element = element;
      element.addEventListener('mousemove', (e) => this._handleMove(e));
      element.addEventListener('mousedown', (e) => this._handleDown(e));
      element.addEventListener('mouseup', (e) => this._handleUp(e));
      element.addEventListener('click', (e) => this._handleClick(e));
      element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._handleRightClick(e);
      });
    } catch (err) {
      this._triggerError('Failed to setup mouse controller', err);
    }
  }

  // Add custom binding
  addBinding(eventName, buttonType) {
    this.customBindings.set(buttonType, eventName);
  }

  _handleMove(e) {
    try {
      const rect = e.target.getBoundingClientRect();
      this.x = e.clientX - rect.left;
      this.y = e.clientY - rect.top;
      
      this._triggerEvent('mousemove', { 
        x: this.x, 
        y: this.y,
        event: e 
      });
      this._broadcast('mousemove', { 
        x: this.x, 
        y: this.y,
        event: e 
      });
    } catch (err) {
      this._triggerError('Mouse move error', err);
    }
  }

  _handleDown(e) {
    try {
      this.isDown = true;
      const eventName = this.customBindings.get(e.button) || 'mousedown';
      this._triggerEvent(eventName, { 
        x: this.x, 
        y: this.y,
        event: e 
      });
      this._broadcast(eventName, { 
        x: this.x, 
        y: this.y,
        event: e 
      });
    } catch (err) {
      this._triggerError('Mouse down error', err);
    }
  }

  _handleUp(e) {
    try {
      this.isDown = false;
      const eventName = this.customBindings.get(e.button) || 'mouseup';
      this._triggerEvent(eventName, { 
        x: this.x, 
        y: this.y,
        event: e 
      });
      this._broadcast(eventName, { 
        x: this.x, 
        y: this.y,
        event: e 
      });
    } catch (err) {
      this._triggerError('Mouse up error', err);
    }
  }

  _handleClick(e) {
    try {
      const eventName = this.customBindings.get(e.button) || 'click';
      this._triggerEvent(eventName, { 
        x: this.x, 
        y: this.y,
        event: e 
      });
      this._broadcast(eventName, { 
        x: this.x, 
        y: this.y,
        event: e 
      });
    } catch (err) {
      this._triggerError('Mouse click error', err);
    }
  }

  _handleRightClick(e) {
    try {
      this._triggerEvent('rightclick', { 
        x: this.x, 
        y: this.y,
        event: e 
      });
      this._broadcast('rightclick', { 
        x: this.x, 
        y: this.y,
        event: e 
      });
    } catch (err) {
      this._triggerError('Right click error', err);
    }
  }

  _broadcast(event, data) {
    try {
      if (this.connectionManager) {
        this.connectionManager.broadcast({
          type: 'mouseEvent',
          event,
          data
        });
      }
    } catch (err) {
      this._triggerError('Broadcast error', err);
    }
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this._triggerError(`Invalid event: ${event}`);
      return;
    }
    this.eventHandlers[event].push(handler);
  }

  _triggerEvent(event, data) {
    this.eventHandlers[event]?.forEach(handler => handler(data));
  }

  _triggerError(message, error) {
    this.eventHandlers['error']?.forEach(handler => 
      handler({ message, error })
    );
  }

  destroy() {
    if (this.element) {
      this.element.removeEventListener('mousemove', this._handleMove);
      this.element.removeEventListener('mousedown', this._handleDown);
      this.element.removeEventListener('mouseup', this._handleUp);
      this.element.removeEventListener('click', this._handleClick);
      this.element.removeEventListener('contextmenu', this._handleRightClick);
    }
  }
}
