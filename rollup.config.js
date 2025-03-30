import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

// Main export
const GamePeerSDK = 'src/modules/GamePeerSDK.js';

export default {
  input: GamePeerSDK,
  external: ['peerjs'],
  output: [
    {
      file: 'dist/gamepeer-sdk.js',
      format: 'umd',
      name: 'GamePeerSDK',
      exports: 'default',
      globals: {
        peerjs: 'Peer'
      }
    },
    {
      file: 'dist/gamepeer-sdk.esm.js',
      format: 'esm',
      exports: 'named',
      globals: {
        peerjs: 'Peer'
      }
    }
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    terser()
  ]
};
