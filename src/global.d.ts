// Global type declarations
interface Window {
  Peer: typeof import('peerjs').default;
  gameInstance?: import('./modules/GamePeerSDK').default;
}
