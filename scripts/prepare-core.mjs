import { spawnSync } from 'node:child_process';

const available =
  spawnSync('wasm-pack', ['--version'], { stdio: 'ignore', shell: true }).status === 0;

if (!available) {
  console.error('[core] wasm-pack not found. The Rust WASM core is generated, not checked in,');
  console.error('[core] and required to run the app: nothing ships without it.');
  console.error('[core] Install it: https://rustwasm.github.io/wasm-pack/installer/');
  process.exit(1);
}

const result = spawnSync('pnpm', ['core:build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
