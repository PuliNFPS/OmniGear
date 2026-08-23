import { spawnSync } from 'node:child_process';

const available =
  spawnSync('wasm-pack', ['--version'], { stdio: 'ignore', shell: true }).status === 0;

if (!available) {
  console.log('[core] wasm-pack not found; using the checked-in development bridge.');
  console.log('[core] Install wasm-pack and run `pnpm core:build` to enable the Rust WASM module.');
  process.exit(0);
}

const result = spawnSync('pnpm', ['core:build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
