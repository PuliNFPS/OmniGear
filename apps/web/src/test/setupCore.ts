import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import init from 'gearhub-core-wasm';

/**
 * Os encoders são síncronos e a glue gerada recusa qualquer chamada antes de
 * `init()`. No navegador quem espera é o `main.tsx`; aqui é este arquivo.
 *
 * O alvo `web` busca o `.wasm` por fetch, que não existe no Node — mas o mesmo
 * `init` aceita os bytes direto, então basta lê-los do disco.
 */
const wasm = readFileSync(
  fileURLToPath(new URL('../../../../packages/core-wasm/pkg/index_bg.wasm', import.meta.url)),
);

await init({ module_or_path: wasm });
