import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const available = spawnSync('cargo', ['--version'], { stdio: 'ignore', shell: true }).status === 0;

if (!available) {
  console.log(`[core] Rust is not installed; skipping ${mode}. See README.md for setup.`);
  process.exit(0);
}

const args =
  mode === 'format' ? ['fmt', '--all'] : ['clippy', '--all-targets', '--', '-D', 'warnings'];
const result = spawnSync('cargo', args, {
  cwd: 'packages/core',
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
