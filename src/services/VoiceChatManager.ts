import Peer, { type MediaConnection } from 'peerjs';

interface VoiceChatOptions {
  enableVideo?: boolean;
  autoConnect?: boolean;
  muted?: boolean;
  maxBitrate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
}

type EventHandler<T extends keyof EventData> = (data: EventData[T]) => void;

interface EventData {
  streamConnected: { peerId: string; stream: MediaStream };
  streamDisconnected: { peerId: string };
  localStreamReady: { stream: MediaStream };
  error: { message: string; error?: Error; peerId?: string };
}

interface VoiceChatEventHandlers {
  streamConnected: EventHandler<'streamConnected'>[];
  streamDisconnected: EventHandler<'streamDisconnected'>[];
  localStreamReady: EventHandler<'localStreamReady'>[];
  error: EventHandler<'error'>[];
}

export default class VoiceChatManager {
  private options: Required<VoiceChatOptions>;
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private connections: Map<string, MediaConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private eventHandlers: VoiceChatEventHandlers = {
    streamConnected: [],
    streamDisconnected: [],
    localStreamReady: [],
    error: []
  };
  private audioContext: AudioContext | null = null;
  private audioNodes: Map<string, AudioNode[]> = new Map();

  constructor(options: VoiceChatOptions = {}) {
    this.options = {
      enableVideo: false,
      autoConnect: false,
      muted: false,
      maxBitrate: 128,
      echoCancellation: true,
      noiseSuppression: true,
      ...options
    };
  }

  async init(peer: Peer): Promise<boolean> {
    this.peer = peer;
    
    this.peer.on('call', (call) => {
      this.handleIncomingCall(call);
    });
    
    if (this.options.autoConnect) {
      await this.getLocalStream();
    }
    
    return true;
  }

  async startBroadcasting(): Promise<boolean> {
    try {
      await this.getLocalStream();
      return true;
    } catch (err) {
      this.triggerError({
        message: 'Failed to start broadcasting',
        error: err as Error
      });
      return false;
    }
  }

  stopBroadcasting(): void {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.connections.forEach(connection => connection.close());
    this.connections.clear();
  }

  async callPeer(peerId: string): Promise<boolean> {
    if (!this.localStream) {
      await this.getLocalStream();
    }

    if (!this.peer || !this.localStream) {
      throw new Error('Voice chat not properly initialized');
    }

    if (this.connections.has(peerId)) {
      console.log(`Already connected to ${peerId}`);
      return false;
    }

    try {
      const call = this.peer.call(peerId, this.localStream);
      this.setupCallEvents(call);
      this.connections.set(peerId, call);
      return true;
    } catch (err) {
      this.triggerError({
        message: `Failed to call peer ${peerId}`,
        error: err as Error
      });
      return false;
    }
  }

  hangUp(peerId: string): boolean {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
      this.removeMediaElements(peerId);
      return true;
    }
    return false;
  }

  hangUpAll(): void {
    this.connections.forEach((connection, peerId) => {
      connection.close();
      this.removeMediaElements(peerId);
    });
    this.connections.clear();
  }

  setMuted(muted: boolean): boolean {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      this.options.muted = muted;
      return true;
    }
    return false;
  }

  setVideoEnabled(enabled: boolean): boolean {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      this.options.enableVideo = enabled;
      return true;
    }
    return false;
  }

  getLocalVideoElement(): HTMLVideoElement {
    const videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.autoplay = true;
    
    if (this.localStream) {
      videoElement.srcObject = this.localStream;
    }
    
    return videoElement;
  }

  createMediaElements(container: HTMLElement = document.body): void {
    this.audioElements.forEach(el => el.parentNode?.removeChild(el));
    this.videoElements.forEach(el => el.parentNode?.removeChild(el));
    this.audioElements.clear();
    this.videoElements.clear();

    this.remoteStreams.forEach((stream, peerId) => {
      this.createMediaElementsForPeer(peerId, stream, container);
    });
  }

  on<T extends keyof EventData>(
    event: T,
    callback: EventHandler<T>
  ): VoiceChatManager {
    (this.eventHandlers[event] as EventHandler<T>[]).push(callback);
    return this;
  }

  off<T extends keyof EventData>(
    event: T,
    callback: EventHandler<T>
  ): VoiceChatManager {
    this.eventHandlers[event] = (this.eventHandlers[event] as EventHandler<T>[])
      .filter(handler => handler !== callback) as VoiceChatEventHandlers[T];
    return this;
  }

  destroy(): void {
    this.stopBroadcasting();
    this.audioElements.forEach(el => el.parentNode?.removeChild(el));
    this.videoElements.forEach(el => el.parentNode?.removeChild(el));
    this.audioElements.clear();
    this.videoElements.clear();
    this.audioContext?.close().catch(console.error);
  }

  private async getLocalStream(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: this.options.echoCancellation,
          noiseSuppression: this.options.noiseSuppression
        },
        video: this.options.enableVideo
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.options.muted) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }

      this.triggerLocalStreamReady({
        stream: this.localStream
      });
    } catch (err) {
      this.triggerError({
        message: 'Failed to access microphone/camera',
        error: err as Error
      });
      throw err;
    }
  }

  private handleIncomingCall(call: MediaConnection): void {
    const answerCall = async () => {
      if (!this.localStream) {
        try {
          await this.getLocalStream();
        } catch (err) {
          console.error('Failed to get local stream for answering call', err);
          return;
        }
      }
      
      call.answer(this.localStream!);
      this.setupCallEvents(call);
      this.connections.set(call.peer, call);
    };
    
    answerCall();
  }

  private setupCallEvents(call: MediaConnection): void {
    call.on('stream', (remoteStream) => {
      this.remoteStreams.set(call.peer, remoteStream);
      this.createMediaElementsForPeer(call.peer, remoteStream);
      this.triggerStreamConnected({
        peerId: call.peer,
        stream: remoteStream
      });
    });

    call.on('close', () => {
      this.connections.delete(call.peer);
      this.remoteStreams.delete(call.peer);
      this.removeMediaElements(call.peer);
      this.triggerStreamDisconnected({
        peerId: call.peer
      });
    });

    call.on('error', (err) => {
      this.triggerError({
        message: `Call error with ${call.peer}`,
        peerId: call.peer,
        error: err
      });
    });
  }

  private createMediaElementsForPeer(
    peerId: string, 
    stream: MediaStream, 
    container: HTMLElement = document.body
  ): void {
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    audioElement.srcObject = stream;
    audioElement.id = `audio-${peerId}`;
    audioElement.style.display = 'none';
    container.appendChild(audioElement);
    this.audioElements.set(peerId, audioElement);

    if (stream.getVideoTracks().length > 0) {
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.srcObject = stream;
      videoElement.id = `video-${peerId}`;
      videoElement.className = 'peer-video';
      videoElement.style.width = '160px';
      videoElement.style.height = '120px';
      videoElement.style.objectFit = 'cover';
      videoElement.style.margin = '5px';
      videoElement.style.borderRadius = '8px';
      container.appendChild(videoElement);
      this.videoElements.set(peerId, videoElement);
    }
  }

  private removeMediaElements(peerId: string): void {
    const audioElement = this.audioElements.get(peerId);
    audioElement?.parentNode?.removeChild(audioElement);
    this.audioElements.delete(peerId);

    const videoElement = this.videoElements.get(peerId);
    videoElement?.parentNode?.removeChild(videoElement);
    this.videoElements.delete(peerId);

    const nodes = this.audioNodes.get(peerId);
    nodes?.forEach(node => node.disconnect());
    this.audioNodes.delete(peerId);
  }

  private triggerStreamConnected(data: { peerId: string; stream: MediaStream }): void {
    this.eventHandlers.streamConnected.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('Error in streamConnected handler:', err);
      }
    });
  }

  private triggerStreamDisconnected(data: { peerId: string }): void {
    this.eventHandlers.streamDisconnected.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('Error in streamDisconnected handler:', err);
      }
    });
  }

  private triggerLocalStreamReady(data: { stream: MediaStream }): void {
    this.eventHandlers.localStreamReady.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('Error in localStreamReady handler:', err);
      }
    });
  }

  private triggerError(data: { message: string; error?: Error; peerId?: string }): void {
    this.eventHandlers.error.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    });
  }
}
