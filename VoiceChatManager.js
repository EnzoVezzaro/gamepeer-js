// VoiceChatManager.js

class VoiceChatManager {
  constructor(options = {}) {
    this.options = {
      enableVideo: false,
      autoConnect: false,
      muted: false,
      maxBitrate: 128, // kbps
      echoCancellation: true,
      noiseSuppression: true,
      ...options
    };
    
    this.peer = null;
    this.localStream = null;
    this.connections = new Map(); // PeerId -> MediaConnection
    this.remoteStreams = new Map(); // PeerId -> MediaStream
    this.audioElements = new Map(); // PeerId -> HTMLAudioElement
    this.videoElements = new Map(); // PeerId -> HTMLVideoElement
    
    this.eventHandlers = {
      'streamConnected': [],
      'streamDisconnected': [],
      'localStreamReady': [],
      'error': []
    };
    
    // Audio context for optional sound processing
    this.audioContext = null;
    this.audioNodes = new Map();
  }
  
  // Initialize the voice chat system
  async init(peer) {
    // Store the PeerJS instance
    this.peer = peer;
    
    // Set up event handlers for new connections
    this.peer.on('call', (call) => {
      this._handleIncomingCall(call);
    });
    
    // Get media stream if autoConnect is enabled
    if (this.options.autoConnect) {
      await this._getLocalStream();
    }
    
    return true;
  }
  
  // Start broadcasting audio/video
  async startBroadcasting() {
    try {
      await this._getLocalStream();
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to start broadcasting',
        error: err
      });
      return false;
    }
  }
  
  // Stop broadcasting
  stopBroadcasting() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Close all connections
    this.connections.forEach(connection => {
      connection.close();
    });
    
    this.connections.clear();
  }
  
  // Call a specific peer
  async callPeer(peerId) {
    if (!this.localStream) {
      await this._getLocalStream();
    }
    
    if (!this.peer || !this.localStream) {
      throw new Error('Voice chat not properly initialized');
    }
    
    // Check if we already have a connection to this peer
    if (this.connections.has(peerId)) {
      console.log(`Already connected to ${peerId}`);
      return;
    }
    
    try {
      // Make the call
      const call = this.peer.call(peerId, this.localStream);
      
      // Handle the connection
      this._setupCallEvents(call);
      this.connections.set(peerId, call);
      
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: `Failed to call peer ${peerId}`,
        error: err
      });
      return false;
    }
  }
  
  // Hang up on a specific peer
  hangUp(peerId) {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
      
      // Clean up audio/video elements
      this._removeMediaElements(peerId);
      
      return true;
    }
    return false;
  }
  
  // Hang up on all peers
  hangUpAll() {
    this.connections.forEach((connection, peerId) => {
      connection.close();
      this._removeMediaElements(peerId);
    });
    
    this.connections.clear();
  }
  
  // Mute/unmute local audio
  setMuted(muted) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !muted;
      });
      
      this.options.muted = muted;
      return true;
    }
    return false;
  }
  
  // Enable/disable local video
  setVideoEnabled(enabled) {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });
      
      this.options.enableVideo = enabled;
      return true;
    }
    return false;
  }
  
  // Get the local video element for display
  getLocalVideoElement() {
    const videoElement = document.createElement('video');
    videoElement.muted = true; // Always mute local video to prevent feedback
    videoElement.autoplay = true;
    
    if (this.localStream) {
      videoElement.srcObject = this.localStream;
    }
    
    return videoElement;
  }
  
  // Create video/audio elements for all peers
  createMediaElements(container) {
    // Clear previous elements
    this.audioElements.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    this.videoElements.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    this.audioElements.clear();
    this.videoElements.clear();
    
    // Create elements for each remote stream
    this.remoteStreams.forEach((stream, peerId) => {
      this._createMediaElementsForPeer(peerId, stream, container);
    });
  }
  
  // Apply audio effect to voice chat (e.g., voice changer)
  applyAudioEffect(peerId, effectType) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const stream = this.remoteStreams.get(peerId);
    if (!stream) return false;
    
    // Clean up previous audio processing if any
    const previousNodes = this.audioNodes.get(peerId);
    if (previousNodes) {
      previousNodes.forEach(node => {
        try {
          node.disconnect();
        } catch (e) {
          console.error('Error disconnecting audio node:', e);
        }
      });
    }
    
    // Create new audio processing chain
    const source = this.audioContext.createMediaStreamSource(stream);
    const destination = this.audioContext.createMediaStreamDestination();
    const nodes = [source];
    
    // Apply selected effect
    switch (effectType) {
      case 'pitch-up':
        const pitchUp = this.audioContext.createBiquadFilter();
        pitchUp.type = 'highshelf';
        pitchUp.frequency.value = 1000;
        pitchUp.gain.value = 15;
        source.connect(pitchUp);
        pitchUp.connect(destination);
        nodes.push(pitchUp);
        break;
        
      case 'pitch-down':
        const pitchDown = this.audioContext.createBiquadFilter();
        pitchDown.type = 'lowshelf';
        pitchDown.frequency.value = 1000;
        pitchDown.gain.value = 15;
        source.connect(pitchDown);
        pitchDown.connect(destination);
        nodes.push(pitchDown);
        break;
        
      case 'robot':
        const distortion = this.audioContext.createWaveShaper();
        function makeDistortionCurve(amount) {
          const k = amount;
          const n_samples = 44100;
          const curve = new Float32Array(n_samples);
          for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
          }
          return curve;
        }
        distortion.curve = makeDistortionCurve(400);
        distortion.oversample = '4x';
        
        source.connect(distortion);
        distortion.connect(destination);
        nodes.push(distortion);
        break;
        
      case 'none':
      default:
        // No effect, just connect source to destination
        source.connect(destination);
        break;
    }
    
    // Store the audio nodes for later cleanup
    this.audioNodes.set(peerId, nodes);
    
    // Update the audio element with the processed stream
    const audioElement = this.audioElements.get(peerId);
    if (audioElement) {
      audioElement.srcObject = destination.stream;
    }
    
    return true;
  }
  
  // Register event handlers
  on(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(callback);
    }
    return this;
  }
  
  // Remove event handlers
  off(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event]
        .filter(handler => handler !== callback);
    }
    return this;
  }
  
  // Clean up resources
  destroy() {
    this.stopBroadcasting();
    
    // Clear all audio/video elements
    this.audioElements.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    this.videoElements.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    this.audioElements.clear();
    this.videoElements.clear();
    
    // Close audio context if it exists
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
    }
  }
  
  // Private methods
  async _getLocalStream() {
    try {
      const constraints = {
        audio: {
          echoCancellation: this.options.echoCancellation,
          noiseSuppression: this.options.noiseSuppression
        },
        video: this.options.enableVideo
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Apply initial mute state
      if (this.options.muted) {
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = false;
        });
      }
      
      this._triggerEvent('localStreamReady', {
        stream: this.localStream
      });
      
      return true;
    } catch (err) {
      this._triggerEvent('error', {
        message: 'Failed to access microphone/camera',
        error: err
      });
      throw err;
    }
  }
  
  _handleIncomingCall(call) {
    console.log(`Incoming call from ${call.peer}`);
    
    // We need a local stream to answer the call
    const answerCall = async () => {
      if (!this.localStream) {
        try {
          await this._getLocalStream();
        } catch (err) {
          console.error('Failed to get local stream for answering call', err);
          return;
        }
      }
      
      // Answer the call
      call.answer(this.localStream);
      this._setupCallEvents(call);
      this.connections.set(call.peer, call);
    };
    
    answerCall();
  }
  
  _setupCallEvents(call) {
    // Handle stream from the remote peer
    call.on('stream', (remoteStream) => {
      console.log(`Received stream from ${call.peer}`);
      this.remoteStreams.set(call.peer, remoteStream);
      
      // Create audio/video elements
      this._createMediaElementsForPeer(call.peer, remoteStream);
      
      this._triggerEvent('streamConnected', {
        peerId: call.peer,
        stream: remoteStream
      });
    });
    
    // Handle call end
    call.on('close', () => {
      console.log(`Call with ${call.peer} ended`);
      this.connections.delete(call.peer);
      this.remoteStreams.delete(call.peer);
      
      // Remove audio/video elements
      this._removeMediaElements(call.peer);
      
      this._triggerEvent('streamDisconnected', {
        peerId: call.peer
      });
    });
    
    // Handle errors
    call.on('error', (err) => {
      console.error(`Call error with ${call.peer}:`, err);
      this._triggerEvent('error', {
        message: `Call error with ${call.peer}`,
        peerId: call.peer,
        error: err
      });
    });
  }
  
  _createMediaElementsForPeer(peerId, stream, container = document.body) {
    // Create audio element
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    audioElement.srcObject = stream;
    audioElement.id = `audio-${peerId}`;
    audioElement.style.display = 'none'; // Hide audio elements
    
    // Append audio element
    container.appendChild(audioElement);
    this.audioElements.set(peerId, audioElement);
    
    // Create video element if stream has video tracks
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.srcObject = stream;
      videoElement.id = `video-${peerId}`;
      videoElement.className = 'peer-video';
      
      // Add some basic styling
      videoElement.style.width = '160px';
      videoElement.style.height = '120px';
      videoElement.style.objectFit = 'cover';
      videoElement.style.margin = '5px';
      videoElement.style.borderRadius = '8px';
      
      // Append video element
      container.appendChild(videoElement);
      this.videoElements.set(peerId, videoElement);
    }
  }
  
  _removeMediaElements(peerId) {
    // Remove audio element
    const audioElement = this.audioElements.get(peerId);
    if (audioElement && audioElement.parentNode) {
      audioElement.srcObject = null;
      audioElement.parentNode.removeChild(audioElement);
    }
    this.audioElements.delete(peerId);
    
    // Remove video element
    const videoElement = this.videoElements.get(peerId);
    if (videoElement && videoElement.parentNode) {
      videoElement.srcObject = null;
      videoElement.parentNode.removeChild(videoElement);
    }
    this.videoElements.delete(peerId);
    
    // Clean up audio processing nodes
    const nodes = this.audioNodes.get(peerId);
    if (nodes) {
      nodes.forEach(node => {
        try {
          node.disconnect();
        } catch (e) {
          // Ignore disconnection errors
        }
      });
      this.audioNodes.delete(peerId);
    }
  }
  
  _triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error('Error in event handler:', err);
        }
      });
    }
  }
}

export default VoiceChatManager;