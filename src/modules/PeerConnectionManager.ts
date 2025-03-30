import { DataConnection, PeerJSOption, PeerConnectOption, Peer } from 'peerjs';

interface ConnectionManagerOptions {
  debug?: boolean;
  peerOptions?: PeerJSOption;
}

interface ConnectionEvent {
  peerId: string;
  conn?: DataConnection;
}

interface DataEvent {
  data: unknown;
  conn: DataConnection;
}

export default class PeerConnectionManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private options: ConnectionManagerOptions;
  private eventHandlers: {
    connection: Array<(event: ConnectionEvent) => void>;
    disconnection: Array<(event: ConnectionEvent) => void>;
    data: Array<(event: DataEvent) => void>;
    error: Array<(error: Error) => void>;
  };

  constructor(options: ConnectionManagerOptions = {}) {
    this.options = options;
    this.eventHandlers = {
      connection: [],
      disconnection: [],
      data: [],
      error: []
    };
  }

  async createPeer(id: string): Promise<string> {
    this.peer = new Peer(id, this.options?.peerOptions);
    
    return new Promise((resolve, reject) => {
      this.peer!.on('open', (peerId) => resolve(peerId));
      this.peer!.on('error', reject);
    });
  }

  async connect(peerId: string, options: PeerConnectOption = {}): Promise<DataConnection> {
    if (!this.peer) throw new Error('Peer not initialized');
    
    const conn = this.peer.connect(peerId, options);
    return new Promise((resolve, reject) => {
      conn.on('open', () => {
        this._setupConnection(conn);
        resolve(conn);
      });
      conn.on('error', reject);
    });
  }

  onConnection(handler: (peerId: string) => void) {
    this.peer?.on('connection', (conn) => {
      this._setupConnection(conn);
      handler(conn.peer);
    });
  }

  broadcast(data: any) {
    this.connections.forEach(conn => conn.send(data));
  }

  private _setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);
    
    conn.on('data', (data) => {
      this._triggerEvent('data', { data, conn });
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this._triggerEvent('disconnection', { peerId: conn.peer });
    });

    this._triggerEvent('connection', { peerId: conn.peer, conn });
  }

  private _triggerEvent(
    type: 'connection' | 'disconnection' | 'data' | 'error',
    payload: any
  ) {
    this.eventHandlers[type].forEach(handler => handler(payload));
  }

  destroy() {
    this.peer?.destroy();
  }
}
