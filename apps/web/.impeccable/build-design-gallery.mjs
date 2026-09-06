import { readFile, writeFile } from 'node:fs/promises';
const catalog = JSON.parse(
  await readFile(new URL('./design-catalog.json', import.meta.url), 'utf8'),
);
const template = await readFile(new URL('./design-review.template.html', import.meta.url), 'utf8');
await writeFile(
  new URL('./design-review.html', import.meta.url),
  template.replace(/\/\* CATALOG \*\/\s*\[\]/, JSON.stringify(catalog).replaceAll('<', '\\u003c')),
);
console.log(`Galeria criada: ${catalog.length} pranchas.`);
