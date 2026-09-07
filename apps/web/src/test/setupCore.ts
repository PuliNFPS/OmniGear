import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import init from 'gearhub-core-wasm';

/**
 * Os encoders são síncronos e a glue gerada recusa qualquer chamada antes de
 * `init()`. No navegador quem espera é o `main.tsx`; aqui é este arquivo.
 *
 * O alvo `web` busca o `.wasm` por fetch, que não existe no Node — mas o mesmo
 * `init` aceita os bytes direto, então basta lê-los do disco.
 *
 * O caminho sai do cwd, e não de `import.meta.url`, porque num teste com
 * `@vitest-environment jsdom` o módulo não tem URL `file:` — resolver por ela
 * quebrava o setup antes de qualquer teste de DOM rodar. O vitest executa com
 * o cwd na raiz do pacote, que é onde vive o `vite.config.ts`.
 */
const wasm = readFileSync(resolve(process.cwd(), '../../packages/core-wasm/pkg/index_bg.wasm'));

await init({ module_or_path: wasm });
