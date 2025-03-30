import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

// Main export
const GamePeerJS = 'src/modules/GamePeerJS.js';

export default {
  input: GamePeerJS,
  external: ['peerjs'],
  output: [
    {
      file: 'dist/gamepeer-js.js',
      format: 'umd',
      name: 'GamePeerJS',
      exports: 'default',
      globals: {
        peerjs: 'Peer'
      }
    },
    {
      file: 'dist/gamepeer-js.esm.js',
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
