import Peer, { DataConnection } from 'peerjs';

interface RoomMetadata {
  maxPlayers?: number;
  gameMode?: string;
  [key: string]: unknown;
}

interface GameRoom {
  hostId: string;
  peerId: string;
  playerCount: number;
  metadata: RoomMetadata;
}

export default class MatchmakingService {
  private peer: Peer | null = null;
  private rooms: Map<string, GameRoom> = new Map();
  private connections: Map<string, DataConnection> = new Map();
  private roomCallbacks: Array<(rooms: GameRoom[]) => void> = [];

  constructor(private options: { debug?: boolean } = {}) {}

  async init(peerId: string): Promise<void> {
    this.peer = new Peer(peerId);
    
    return new Promise((resolve) => {
      this.peer!.on('open', () => {
        this.setupConnectionHandlers();
        resolve();
      });
    });
  }

  private setupConnectionHandlers() {
    this.peer!.on('connection', (conn) => {
      conn.on('data', (data) => this.handleRoomData(conn, data));
      this.connections.set(conn.peer, conn);
    });
  }

  private handleRoomData(conn: DataConnection, data: any) {
    if (data.type === 'roomList') {
      this.updateRooms(data.rooms);
    }
  }

  private updateRooms(newRooms: GameRoom[]) {
    newRooms.forEach(room => {
      this.rooms.set(room.hostId, room);
    });
    this.notifyRoomUpdate();
  }

  private notifyRoomUpdate() {
    const rooms = Array.from(this.rooms.values());
    this.roomCallbacks.forEach(cb => cb(rooms));
  }

  async registerRoom(metadata: RoomMetadata = {}): Promise<void> {
    if (!this.peer) throw new Error('Not initialized');
    
    const room: GameRoom = {
      hostId: this.peer.id,
      peerId: this.peer.id,
      playerCount: 1,
      metadata
    };
    
    this.rooms.set(this.peer.id, room);
    this.broadcastRoomList();
  }

  private broadcastRoomList() {
    const rooms = Array.from(this.rooms.values());
    this.connections.forEach(conn => {
      conn.send({
        type: 'roomList',
        rooms: rooms.filter(r => r.hostId !== conn.peer)
      });
    });
  }

  async refreshRooms(): Promise<void> {
    if (!this.peer) throw new Error('Not initialized');
    this.broadcastRoomList();
  }

  findRooms(filters: Partial<RoomMetadata> = {}): GameRoom[] {
    return Array.from(this.rooms.values()).filter(room => {
      return Object.entries(filters).every(([key, value]) => {
        return room.metadata[key] === value;
      });
    });
  }

  on(event: 'roomsUpdated', callback: (rooms: GameRoom[]) => void): void {
    if (event === 'roomsUpdated') {
      this.roomCallbacks.push(callback);
    }
  }

  destroy(): void {
    this.peer?.destroy();
    this.connections.forEach(conn => conn.close());
  }
}
