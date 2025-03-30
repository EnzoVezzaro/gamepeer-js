// MouseController.js - Tracks and broadcasts mouse input
export default class MouseController {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
    this.x = 0;
    this.y = 0;
    this.isDown = false;
    this.eventHandlers = {
      'mousemove': [],
      'mousedown': [],
      'mouseup': [],
      'click': []
    };
  }

  setup(element) {
    element.addEventListener('mousemove', (e) => this._handleMove(e));
    element.addEventListener('mousedown', (e) => this._handleDown(e));
    element.addEventListener('mouseup', (e) => this._handleUp(e));
    element.addEventListener('click', (e) => this._handleClick(e));
  }

  _handleMove(e) {
    const rect = e.target.getBoundingClientRect();
    this.x = e.clientX - rect.left;
    this.y = e.clientY - rect.top;
    
    this._triggerEvent('mousemove', { x: this.x, y: this.y });
    this._broadcast('mousemove', { x: this.x, y: this.y });
  }

  _handleDown(e) {
    this.isDown = true;
    this._triggerEvent('mousedown', { x: this.x, y: this.y });
    this._broadcast('mousedown', { x: this.x, y: this.y });
  }

  _handleUp(e) {
    this.isDown = false;
    this._triggerEvent('mouseup', { x: this.x, y: this.y });
    this._broadcast('mouseup', { x: this.x, y: this.y });
  }

  _handleClick(e) {
    this._triggerEvent('click', { x: this.x, y: this.y });
    this._broadcast('click', { x: this.x, y: this.y });
  }

  _broadcast(event, data) {
    if (this.connectionManager) {
      this.connectionManager.broadcast({
        type: 'mouseEvent',
        event,
        data
      });
    }
  }

  on(event, handler) {
    this.eventHandlers[event] ??= [];
    this.eventHandlers[event].push(handler);
  }

  _triggerEvent(event, data) {
    this.eventHandlers[event]?.forEach(handler => handler(data));
  }
}
