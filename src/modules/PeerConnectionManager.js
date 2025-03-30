// PeerConnectionManager.js - Handles PeerJS connections

export default class PeerConnectionManager {
  constructor(peerOptions = {}) {
    this.peer = null;
    this.connections = new Map();
    this.eventHandlers = {
      'connection': [],
      'disconnection': [],
      'data': [],
      'error': []
    };
    this.peerOptions = peerOptions;
  }

  async createPeer(id) {
    this.peer = new Peer(id || undefined, this.peerOptions);
    
    return new Promise((resolve, reject) => {
      this.peer.on('open', (id) => {
        resolve(id);
      });
      this.peer.on('error', reject);
    });
  }

  async connect(peerId, options = {}) {
    const conn = this.peer.connect(peerId, options);
    
    return new Promise((resolve, reject) => {
      conn.on('open', () => {
        this._setupConnection(conn);
        resolve(conn);
      });
      conn.on('error', reject);
    });
  }

  onConnection(handler) {
    this.peer.on('connection', (conn) => {
      this._setupConnection(conn);
      handler(conn);
    });
  }

  _setupConnection(conn) {
    this.connections.set(conn.peer, conn);
    
    conn.on('data', (data) => {
      this._triggerEvent('data', { conn, data });
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this._triggerEvent('disconnection', { peerId: conn.peer });
    });
  }

  send(peerId, data) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.send(data);
    }
  }

  broadcast(data) {
    this.connections.forEach(conn => conn.send(data));
  }

  on(eventName, handler) {
    this.eventHandlers[eventName] ??= [];
    this.eventHandlers[eventName].push(handler);
  }

  _triggerEvent(eventName, data) {
    this.eventHandlers[eventName]?.forEach(handler => handler(data));
  }

  destroy() {
    this.peer?.destroy();
  }
}
