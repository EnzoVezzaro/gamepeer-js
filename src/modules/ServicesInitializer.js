/**
 * ServicesInitializer - Handles initialization and management of GamePeerJS services
 */
import KeyboardController from '../services/KeyboardController.js';
import MouseController from '../services/MouseController.js';
import MatchmakingService from '../services/MatchmakingService.js';
import VoiceChatManager from '../services/VoiceChatManager.js';

export default class ServicesInitializer {
  constructor(gamePeerInstance) {
    if (!gamePeerInstance) throw new Error('Game instance required');
    this.game = gamePeerInstance;
    this.debug = gamePeerInstance.options.debug; // Store debug flag
    this.log = this.debug ? console.log.bind(console, '[ServicesInitializer]') : () => {}; // Setup logger
    this.game.services = this;
    this._initServices();
  }

  _initServices() {
    this.log('initializing services: ', this.game);
    
    // Initialize all enabled services
    if (this.game.options.useKeyboardController) {
      this.keyboardController = new KeyboardController({
        game: this.game,
        connectionManager: this.game.connectionManager,
        playerId: this.game.localPlayerId,
        debug: this.game.options.debug, // Pass debug flag
        ...this.game.options.keyboardOptions
      });
      this.log('Keyboard controller initialized: ', this.keyboardController);
      this.game.keyboardController = this.keyboardController;
    }

    if (this.game.options.useMouseController) {
      this.mouseController = new MouseController({
        connectionManager: this.game.connectionManager,
        debug: this.game.options.debug, // Pass debug flag
        ...this.game.options.mouseOptions
      });
      this.game.mouseController = this.mouseController;
      this.log('Mouse controller initialized: ', this.mouseController);
    }

    if (this.game.options.useMatchmaking) {
      this.matchmaking = new MatchmakingService({
        connectionManager: this.game.connectionManager,
        ...this.game.options.matchmakingOptions,
        game: this.game,
        playerId: this.game.localPlayerId,
        debug: this.game.options.debug // Pass debug flag
      });
      this.matchmaking.on('roomsUpdated', (rooms) => {
        this.game._triggerEvent('roomsUpdated', rooms);
      });
      this.game.matchmaking = this.matchmaking;
      this.log('Matchmaking service initialized: ', this.matchmaking);
    }

    if (this.game.options.useVoiceChat) {
      this.voiceChat = new VoiceChatManager({
        ...this.game.options.voiceChatOptions,
        debug: this.game.options.debug // Pass debug flag
      });
      this.voiceChat.on('connected', (peerId) => {
        this.game._triggerEvent('voiceChatConnected', { peerId });
      });
      this.voiceChat.on('disconnected', (peerId) => {
        this.game._triggerEvent('voiceChatDisconnected', { peerId });
      });
      this.game.voiceChat = this.voiceChat;
      this.log('Voice chat service initialized: ', this.voiceChat);
    }
  }

  /**
   * Gets keyboard controller instance
   * @throws Error if keyboard controller not enabled or accessed before room creation
   */
  getKeyboardController() {
    if (!this.game.options.useKeyboardController) {
      this.log('Keyboard controller not enabled in options'); // Use this.log
      return;
    }
    if (!this.game.clientId) {
      throw new Error('KeyboardController requires active game connection');
    }
    return this.keyboardController;
  }

  /**
   * Gets mouse controller instance
   * @throws Error if mouse controller not enabled or accessed before room creation
   */
  getMouseController() {
    if (!this.game.options.useMouseController) {
      this.log('Mouse controller not enabled in options'); // Use this.log
      return;
    }
    if (!this.game.clientId) {
      throw new Error('MouseController requires active game connection');
    }
    return this.mouseController;
  }

  /**
   * Gets matchmaking service instance
   * @throws Error if accessed before room creation
   */
  getMatchmakingService() {
    if (!this.game.options.useMatchmaking) {
      this.log('Matchmaking service not enabled in options'); // Use this.log
      return;
    }
    if (!this.game.clientId) {
      throw new Error('Matchmaking requires active game connection');
    }
    return this.matchmaking;
  }

  /**
   * Gets voice chat manager instance
   * @throws Error if accessed before room creation
   */
  getVoiceChatManager() {
    if (!this.game.options.useVoiceChat) {
      this.log('VoiceChat not enabled in options'); // Use this.log
      return;
    }
    if (!this.game.clientId) {
      throw new Error('VoiceChat requires active game connection');
    }
    return this.voiceChat;
  }

  /**
   * Clean up all services
   */
  destroy() {
    if (this.keyboardController) this.keyboardController.destroy();
    if (this.mouseController) this.mouseController.destroy();
    if (this.voiceChatController) this.voiceChatController.destroy();
    if (this.matchmakingController) this.matchmakingController.destroy();
    this.keyboardController = null;
    this.mouseController = null;
    this.matchmakingController = null;
    this.voiceChatController = null;
  }
}
