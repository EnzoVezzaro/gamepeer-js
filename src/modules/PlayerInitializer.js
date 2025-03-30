/**
 * PlayerInitializer - Handles safe player initialization with connection awareness
 */
export default class PlayerInitializer {
  constructor(gamePeer, options = {}) {
    if (!gamePeer) {
      throw new Error('GamePeer instance is required');
    }

    this.gamePeer = gamePeer;
    this.options = {
      defaultPlayerName: 'Player',
      defaultX: 0,
      defaultY: 0,
      colorPalette: [
        '#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3',
        '#33FFF3', '#FF33A8', '#8A33FF', '#33FF8A', '#FF8A33'
      ],
      ...options
    };
    
    this.players = {};
    this.initialized = false;
    this.localPlayerId = null;
  }

  /**
   * Initialize the player system (call after room is created)
   * @async
   */
  async initialize() {
    if (this.initialized) return;
    
    if (!this.gamePeer.connectionManager.peer) {
      throw new Error('Cannot initialize player - connection not established');
    }

    if (!this.gamePeer.clientId) {
      throw new Error('Cannot initialize player - missing client it');
    }

    this.localPlayerId = `player_${this.gamePeer.clientId}`;
    this.initialized = true;
  }

  /**
   * Create and register the local player
   * @async
   * @returns {Promise<object>} Player data
   * @throws {Error} If not initialized or connection issues
   */
  async createLocalPlayer() {
    if (!this.initialized) {
      throw new Error('PlayerInitializer not initialized - call initialize() first');
    }

    if (!this.localPlayerId) {
      throw new Error('Missing localPlayerId');
    }

    // Verify connection is ready
    if (!this.gamePeer.connectionManager.peer.open) {
      throw new Error('Cannot create player - connection not ready');
    }

    const playerData = {
      name: `${this.options.defaultPlayerName} ${this.gamePeer.clientId.substr(0, 5)}`,
      x: this._getRandomPosition(this.options.defaultX),
      y: this._getRandomPosition(this.options.defaultY),
      color: this._getRandomColor(),
      id: this.localPlayerId
    };

    if (!this._validatePlayerData(playerData)) {
      throw new Error('Invalid player data generated');
    }

    this.players[this.localPlayerId] = playerData;
    return playerData;
  }

  /**
   * Get current player data
   * @returns {object|null} Player data or null
   */
  getLocalPlayer() {
    return this.players[this.localPlayerId] || null;
  }

  /**
   * Validate player data structure
   * @private
   */
  _validatePlayerData(data) {
    return data && 
      typeof data === 'object' &&
      typeof data.name === 'string' &&
      typeof data.x === 'number' && 
      typeof data.y === 'number' &&
      typeof data.color === 'string' &&
      typeof data.id === 'string';
  }

  /**
   * Get random position near default
   * @private
   */
  _getRandomPosition(defaultPos) {
    return defaultPos + Math.floor(Math.random() * 200 - 100);
  }

  /**
   * Get random color from palette
   * @private
   */
  _getRandomColor() {
    return this.options.colorPalette[
      Math.floor(Math.random() * this.options.colorPalette.length)
    ];
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.players = {};
    this.initialized = false;
    this.localPlayerId = null;
  }
}
