// GameState.js - Game state management

export default class GameState {
  constructor() {
    this.state = {};
  }
  
  set(key, value) {
    this.state[key] = value;
  }
  
  get(key) {
    return this.state[key];
  }
  
  getFullState() {
    return this.state;
  }
  
  updateState(updates) {
    Object.assign(this.state, updates);
  }
}
