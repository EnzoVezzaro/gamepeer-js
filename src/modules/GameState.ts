interface GameStateData {
  [key: string]: unknown;
}

export default class GameState {
  private state: GameStateData;

  constructor() {
    this.state = {};
  }

  set(key: string, value: unknown): void {
    this.state[key] = value;
  }

  get<T = unknown>(key: string): T | undefined {
    return this.state[key] as T;
  }

  getFullState(): GameStateData {
    return this.state;
  }

  updateState(updates: Record<string, unknown>): void {
    Object.assign(this.state, updates);
  }
}
