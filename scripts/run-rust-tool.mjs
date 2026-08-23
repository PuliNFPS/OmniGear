import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/core');

const mode = process.argv[2];
const available = spawnSync('cargo', ['--version'], { stdio: 'ignore', shell: true }).status === 0;

if (!available) {
  console.log(`[core] Rust is not installed; skipping ${mode}. See README.md for setup.`);
  process.exit(0);
}

const commands = {
  audit: ['machete', '.'],
  format: ['fmt', '--all'],
  lint: ['clippy', '--all-targets', '--', '-D', 'warnings'],
  test: ['test', '--all-targets'],
};
const args = commands[mode];

if (!args) {
  console.error(`[core] Unknown Rust tool mode: ${mode}`);
  process.exit(2);
}
const result = spawnSync('cargo', args, {
  cwd: coreDirectory,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
