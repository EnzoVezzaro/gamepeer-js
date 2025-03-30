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
    this.game.services = this;
    this._initServices();
  }

  _initServices() {
    console.log('initializing services: ', this.game);
    
    // Initialize all enabled services
    if (this.game.options.useKeyboardController) {
      this.keyboardController = new KeyboardController({
        connectionManager: this.game.connectionManager,
        playerId: this.game.localPlayerId,
        ...this.game.options.keyboardOptions
      });
      console.log('Keyboard controller initialized: ', this.keyboardController);
      this.game.keyboardController = this.keyboardController;
    }

    if (this.game.options.useMouseController) {
      this.mouseController = new MouseController({
        connectionManager: this.game.connectionManager,
        ...this.game.options.mouseOptions
      });
      this.game.mouseController = this.mouseController;
      console.log('Mouse controller initialized: ', this.mouseController);
    }

    if (this.game.options.useMatchmaking) {
      this.matchmaking = new MatchmakingService(this.game.options.matchmakingOptions);
      this.matchmaking.on('roomsUpdated', (rooms) => {
        this.game._triggerEvent('roomsUpdated', rooms);
      });
      this.game.matchmaking = this.matchmaking;
      console.log('Matchmaking service initialized: ', this.matchmaking);
    }

    if (this.game.options.useVoiceChat) {
      this.voiceChat = new VoiceChatManager(this.game.options.voiceChatOptions);
      this.voiceChat.on('connected', (peerId) => {
        this.game._triggerEvent('voiceChatConnected', { peerId });
      });
      this.voiceChat.on('disconnected', (peerId) => {
        this.game._triggerEvent('voiceChatDisconnected', { peerId });
      });
      this.game.voiceChat = this.voiceChat;
      console.log('Voice chat service initialized: ', this.voiceChat);
    }
  }

  /**
   * Gets keyboard controller instance
   * @throws Error if keyboard controller not enabled or accessed before room creation
   */
  getKeyboardController() {
    if (!this.game.options.useKeyboardController) {
      console.log('Keyboard controller not enabled in options');
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
      console.log('Mouse controller not enabled in options');
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
      console.log('Matchmaking service not enabled in options');
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
      console.log('VoiceChat not enabled in options');
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
