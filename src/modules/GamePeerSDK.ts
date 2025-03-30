// GamePeerSDK.ts - Browser-to-browser P2P game SDK using PeerJS

import MatchmakingService from '../services/MatchmakingService';
import VoiceChatManager from '../services/VoiceChatManager';
import GameState from './GameState';
import PeerConnectionManager from './PeerConnectionManager';
import type { PeerJSOption } from 'peerjs';

interface GamePeerSDKOptions {
  debug?: boolean;
  tickRate?: number;
  peerOptions?: PeerJSOption;
  useMatchmaking?: boolean;
  matchmakingOptions?: any;
  useVoiceChat?: boolean;
  voiceChatOptions?: any;
}

interface Player {
  name: string;
  x: number;
  y: number;
  color: string;
  id: string;
}

interface GameObject {
  type: string;
  ownerId: string;
  [key: string]: any;
}

declare global {
  interface Window {
    Peer: typeof import('peerjs').default;
  }
}

export default class GamePeerSDK {
  private options: GamePeerSDKOptions;
  private connectionManager: PeerConnectionManager;
  private gameState: GameState;
  private isHost: boolean = false;
  private clientId: string | null = null;
  private players: Record<string, Player> = {};
  private gameObjects: Record<string, GameObject> = {};
  private matchmaking: MatchmakingService | null = null;
  private voiceChat: VoiceChatManager | null = null;
  private eventHandlers: Record<string, Array<(data: any) => void>> = {};

  constructor(options: GamePeerSDKOptions = {}) {
    this.options = {
      debug: false,
      tickRate: 20,
      ...options
    };

    this.connectionManager = new PeerConnectionManager({
      peerOptions: this.options.peerOptions
    });

    this.gameState = new GameState();

    if (this.options.useMatchmaking) {
      this.matchmaking = new MatchmakingService(this.options.matchmakingOptions);
    }
    
    if (this.options.useVoiceChat) {
      this.voiceChat = new VoiceChatManager(this.options.voiceChatOptions);
    }
  }

  private async loadPeerJS(): Promise<void> {
    if (typeof window.Peer !== 'undefined') return Promise.resolve();

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.4.7/peerjs.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  async hostGame(roomId?: string): Promise<string> {
    await this.loadPeerJS();
    return '';
  }

  async joinGame(roomId: string): Promise<void> {
    await this.loadPeerJS();
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }

  private triggerEvent(event: string, data: any): void {
    this.eventHandlers[event]?.forEach(handler => handler(data));
  }

  disconnect(): void {
    this.connectionManager.destroy();
    this.voiceChat?.destroy();
  }
}
