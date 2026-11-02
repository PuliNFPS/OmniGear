# Correções da auditoria de 2026-10-23 — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** Aplicar os 12 achados da auditoria `ponytail-audit` de 2026-10-23, sem mudar nenhum byte que o app envia ao mouse.

**Architecture:** Uma tarefa por achado (ou por par de achados que tocam o mesmo arquivo), teste primeiro quando há comportamento novo. Regra de dispositivo — o que o mouse aceita, quando se pode gravar na flash — entra no núcleo Rust; a casca ganha só o texto da mensagem e o conserto de fluxo (reassinar o driver depois de reconectar, reconectar antes de repetir).

**Tech Stack:** Rust 2024 (`packages/core`, ponte `packages/core-wasm`), TypeScript/React/Zustand/Vitest (`apps/web`), turbo, pnpm, GitHub Actions.

**Spec:** a auditoria de 2026-10-23 (não há arquivo; ela está resumida na tabela abaixo e os critérios de cada achado estão na própria tarefa). Convenções do repositório: `CLAUDE.md`.

**Baseline medido antes de qualquer mudança (2026-10-23):** `cargo test --workspace --all-targets` → 134 + 15 testes passam. `pnpm test` → 33 arquivos / 382 testes passam (o turbo reaproveitou 4 de 5 tarefas do cache, por isso o `cargo test` direto foi rodado à parte). `pnpm verify` completo (format, lint, build, audit) **ainda não foi rodado**; a Tarefa 11 o roda.

| Achado | O que é                                                       | Tarefa |
| ------ | ------------------------------------------------------------- | ------ |
| 1      | Depois de reconectar, a tela segue o driver antigo            | 2      |
| 2      | "Reconectar" repete cedo demais e engole a falha              | 3      |
| 3      | Gravar na flash antes de o mouse relatar a memória            | 4      |
| 4      | O núcleo não confere faixas; valores grandes dão a volta      | 5      |
| 5      | Hash com percent-encoding inválido derruba o app              | 1      |
| 6      | 64 MB de PNGs de design no git                                | 10     |
| 7      | `switchProfile` é código morto                                | 6      |
| 8      | Sobrecargas e apelidos antigos na ponte                       | 7      |
| 9      | CI compila duas ferramentas cargo a cada execução             | 9      |
| 10     | Arquivos soltos na árvore                                     | 10     |
| 11     | Regras do knip desatualizadas                                 | 8      |
| 12     | Comentários dizem "somente leitura" para uma página que grava | 8      |

## Global Constraints

- O núcleo **não faz I/O**, **é síncrono** e **não conhece `wasm-bindgen`**.
- Erro novo que atravessa a ponte: variante em `RawmError`, código estável em `code()` (travado por literal no teste de `error.rs`), texto em `apps/web/src/core/rawmError.ts`. O núcleo nunca carrega texto de interface.
- Nada em `packages/shared/src/generated/` muda neste plano (nenhum tipo `ts-rs` novo). Se o teste de bindings reclamar, algo saiu do escopo.
- **Nunca commitar** o que o `wasm-pack` gera (`packages/core-wasm/pkg`). Não remover as três proteções de cache do `turbo`.
- O vitest direto usa o `.wasm` já construído: depois de qualquer mudança em Rust, rode `pnpm core:build` antes de `pnpm --filter @gearhub/web exec vitest run …`.
- **Commits sem atribuição de IA** (nada de `Co-Authored-By`, `Generated with`, `Claude-Session`) — regra global do usuário. Mensagens no estilo do repositório: `tipo: assunto em português sem acento`.
- A árvore atual tem arquivos modificados de `graphify-out/` que **não** são desta mudança. Execute num worktree (`superpowers:using-git-worktrees`, depois `pnpm install` e `pnpm core:build`) numa branch `fix/auditoria-2026-10-23` saída da `main`, e use sempre `git add <arquivo>` explícito — nunca `git add -A` nem `git commit -a`.
- Mudança no caminho de escrita exige confirmação no hardware: Tarefa 11.
- Comandos de teste isolado: `pnpm --filter @gearhub/web exec vitest run <arquivo>`; `cargo test -p gearhub-core <nome>`.

## Review Focus

Entradas que o plano não pode deixar quebrar, e a tarefa cujo teste as trava:

1. Depois de trocar de driver (reconexão), a lista de perfis mostra o que o **novo** driver relatou, não os valores de fábrica — Tarefa 2.
2. Clicar em Salvar antes de o dump de memórias chegar dá uma mensagem clara e **não envia nada** — Tarefa 4.
3. Um mouse com estágio de DPI fora do passo de 50 (o software do fabricante pode permitir) continua aplicando; só o que dá a volta no campo é recusado — Tarefa 5.
4. Reconectar que falha, ou que não encontra o aparelho, não toca o rascunho e deixa rastro no console — Tarefa 3.
5. Um hash com `%` malformado, mesmo recarregando a página, abre a home — Tarefa 1.

**Limites conhecidos, fora deste plano:** um dump que chega _incompleto mas terminado_ (entradas perdidas, `0xff` recebido) não é detectável sem uma contagem, e a guarda da Tarefa 4 não o pega. A aplicação à sessão (`begin_apply`) sem dump continua apagando macros da sessão até desligar o mouse (comportamento anterior, não flash). O driver antigo nunca recebe `close()` depois de reconectar. O histórico do git continua guardando os PNGs da Tarefa 10.

---

### Task 1: Hash malformado não derruba o app (achado 5)

**Files:**

- Modify: `apps/web/src/app/routes.ts` (`parseHash`, linhas 23-30)
- Test: `apps/web/src/app/routes.test.ts`

**Interfaces:**

- Produces: `parseHash(hash: string): Route` nunca lança; um id de dispositivo com percent-encoding inválido devolve `homeRoute`.

- [ ] **Step 1: Escrever o teste que falha** — dentro de `describe('parseHash')`:

```ts
it('falls back to home when the device id is not valid percent-encoding', () => {
  expect(parseHash('#/dispositivo/%E0%A4%A/dpi')).toEqual({ name: 'home' });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @gearhub/web exec vitest run src/app/routes.test.ts`. Esperado: FAIL com `URIError: URI malformed`.

- [ ] **Step 3: Implementar** — em `parseHash`, embrulhar o `decodeURIComponent(deviceId)` num `try`/`catch` que devolve `homeRoute`. É o único ponto que lança; `section` não é decodificado.

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando. Esperado: PASS (5 testes no arquivo).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/routes.ts apps/web/src/app/routes.test.ts
git commit -m "fix: hash com percent-encoding invalido abre a home em vez de derrubar o app"
```

---

### Task 2: Reassinar o driver depois de reconectar (achado 1)

**Files:**

- Modify: `apps/web/src/app/useDeviceReports.ts` (a constante `followed`, linhas 45-47, e o comentário acima dela)
- Test: `apps/web/src/app/useDeviceReports.test.ts`

**Interfaces:**

- Consumes (já existem): `replayingDriver(slots)` → `{ driver, subscriptions() }` no próprio arquivo de teste; `registerDeviceDriver`; `useDeviceStore.getState().markDisconnected(id)` e `.updateDevice(id, update)`.
- Produces: nada novo. A chave de assinatura passa a incluir o status de conexão.

- [ ] **Step 1: Escrever o teste que falha** — importar `act` de `@testing-library/react` e acrescentar:

```ts
it('follows the new driver after the device reconnects under the same id', () => {
  const device = liveMouse();
  const first = replayingDriver([{ index: 0, bindings: [] }]);
  registerDeviceDriver(DEVICE_ID, first.driver);
  useDeviceStore.setState({ devices: [device] });
  renderHook(() => useDeviceReports(useDeviceStore((state) => state.devices)));
  expect(first.subscriptions()).toBe(1);

  // O que "Reconectar" faz: um driver novo sob o mesmo id, e um aparelho
  // recém-descrito (perfis de volta aos valores de fábrica) no lugar do antigo.
  const second = replayingDriver([{ index: 0, bindings: [] }]);
  act(() => useDeviceStore.getState().markDisconnected(DEVICE_ID));
  registerDeviceDriver(DEVICE_ID, second.driver);
  act(() => useDeviceStore.getState().updateDevice(DEVICE_ID, () => liveMouse()));

  expect(second.subscriptions()).toBe(1);
  const settings = useDeviceStore
    .getState()
    .devices[0].profiles.find((profile) => profile.index === 1)?.settings;
  if (!settings || !('buttons' in settings)) throw new Error('esperava um perfil de mouse');
  expect(new Set(Object.values(settings.buttons))).toEqual(new Set(['desativado']));
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @gearhub/web exec vitest run src/app/useDeviceReports.test.ts`. Esperado: FAIL em `expected 0 to be 1` (o efeito não rodou de novo, o driver novo nunca foi ouvido).

- [ ] **Step 3: Implementar** — em `useDeviceReports.ts`, `followed` passa a serializar `[device.id, device.status]` por dispositivo não-demo em vez de só o id. Atualizar o comentário: a reconexão registra um driver novo sob o mesmo id, e só o status muda — é ele que refaz a assinatura. Cuidado a manter: o status só muda em desconexão/reconexão, nunca dentro do laço de replay do dump, então o bug do loop de atualização que o comentário descreve não volta.

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando. Esperado: os 4 testes passam, inclusive `subscribes once even though the dump it replays updates the store`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/useDeviceReports.ts apps/web/src/app/useDeviceReports.test.ts
git commit -m "fix: reassinar o driver quando o aparelho reconecta sob o mesmo id"
```

---

### Task 3: "Reconectar" espera, repete e reporta (achado 2)

**Files:**

- Modify: `apps/web/src/store/deviceStore.ts` (interface linha 33; ação `reconnect`, linhas 140-144)
- Modify: `apps/web/src/components/DeviceWorkspace.tsx:191-194`
- Test: `apps/web/src/store/deviceStore.test.ts`
- Create: `apps/web/src/components/DeviceWorkspace.reconnect.test.tsx`

**Interfaces:**

- Consumes: `restoreAuthorizedDevices` de `../hardware/deviceDiscovery`; `reportHardwareFailure(operation, error)` de `../hardware/hardwareFailure`.
- Produces: `reconnect(deviceId: string): Promise<boolean>` — `true` quando o aparelho autorizado foi achado e colocado no lugar; `false` quando não foi achado **ou** quando reabrir falhou (e então `reportHardwareFailure('reconectar o dispositivo', error)` é chamado).

- [ ] **Step 1: Testes do store** — em `deviceStore.test.ts`, estender o `vi.mock` existente com `restoreAuthorizedDevices: restoreMock` (criado com `vi.hoisted`), e no `beforeEach` fazer `restoreMock.mockReset(); restoreMock.mockResolvedValue([])` (o `restoreSession` também o chama). Novo `describe('reconnecting a device')`:
  - `resolves true and swaps in the restored device`: lista com o aparelho `desconectado` (`id: 'mouse-real'`); `restoreMock` devolve a versão `conectado`; `await reconnect('mouse-real')` é `true` e `devices` é `[connected]`.
  - `resolves false and leaves the list alone when the device is not among the authorized ones`: `restoreMock` devolve `[]`; resultado `false`; `devices` continua `[existing]`; `console.error` não é chamado.
  - `resolves false and reports when reopening throws`: `restoreMock.mockRejectedValue(new Error('boom'))`; `vi.spyOn(console, 'error').mockImplementation(() => {})`; resultado `false`; `expect(spy).toHaveBeenCalledWith(expect.stringContaining('Falha ao reconectar o dispositivo'), expect.any(Error))`; `devices` inalterado.

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @gearhub/web exec vitest run src/store/deviceStore.test.ts`. Esperado: FAIL no primeiro (`undefined` no lugar de `true`) e no terceiro (o `.catch(() => [])` engole a falha, nenhum `console.error`).

- [ ] **Step 3: Implementar `reconnect` no store** — assinatura `reconnect(deviceId: string): Promise<boolean>` na interface e na ação. Corpo: `try` chama `restoreAuthorizedDevices()`, procura o `id`, devolve `false` se não achou, senão `get().updateDevice(deviceId, () => device)` e `true`; no `catch`, `reportHardwareFailure('reconectar o dispositivo', error)` e `false`. Remover o `.catch(() => [])`.

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando.

- [ ] **Step 5: Teste do componente** — `DeviceWorkspace.reconnect.test.tsx` (jsdom), no molde de `DeviceWorkspace.liveDpi.test.tsx`. Mockar `restoreAuthorizedDevices` como no store. Montar `<DeviceWorkspace device sectionId="geral" />` com um mouse `desconectado`, um driver registrado `{ applyToSession: vi.fn(async () => {}), writeProfile: vi.fn(async () => {}) }` e a entrada do editor em `status: 'falha-aplicacao'` (`{ ...initialEntry(device), status: 'falha-aplicacao' }`). Dois testes:
  - `retries the failed apply only after the device is back`: o `restoreMock` devolve uma promessa controlada pelo teste. Clicar no botão "Reconectar": `applyToSession` ainda **não** foi chamado. Resolver a promessa com o aparelho `conectado` dentro de `await act(async () => …)`: `applyToSession` foi chamado **uma** vez.
  - `does not retry when the device did not come back`: `restoreMock` devolve `[]`; depois de clicar e esvaziar as promessas, `applyToSession` nunca foi chamado.

- [ ] **Step 6: Rodar e ver falhar** — `pnpm --filter @gearhub/web exec vitest run src/components/DeviceWorkspace.reconnect.test.tsx`. Esperado: o primeiro teste falha (`retry` rodou antes do aparelho voltar e nada repete depois: 0 chamadas onde se espera 1).

- [ ] **Step 7: Implementar no componente** — `onReconnect` passa a `void reconnect(device.id).then((restored) => { if (restored) retry(device); })`. `retry` já relê o aparelho vivo do store, então passar o `device` capturado está certo.

- [ ] **Step 8: Rodar a suíte web inteira e commitar** — `pnpm --filter @gearhub/web test`. Esperado: tudo passa.

```bash
git add apps/web/src/store/deviceStore.ts apps/web/src/store/deviceStore.test.ts apps/web/src/components/DeviceWorkspace.tsx apps/web/src/components/DeviceWorkspace.reconnect.test.tsx
git commit -m "fix: reconectar espera o aparelho voltar antes de repetir e reporta a falha"
```

---

### Task 4: Gravar na flash só depois de o mouse relatar a memória (achado 3)

**Files:**

- Modify: `packages/core/src/protocols/rawm/error.rs` (variante, `code()`, teste de códigos)
- Modify: `packages/core/src/drivers/leviathan_v4/session.rs` (`begin_write_profile`, linhas 258-283; testes)
- Modify: `packages/core/vectors/rawm-protocol.json` (`sessionWriteProfile[1]`)
- Modify: `apps/web/src/core/rawmError.ts`
- Modify: `apps/web/src/hardware/rawm/leviathanV4Harness.ts`
- Test: `apps/web/src/core/rawmError.test.ts`, `apps/web/src/hardware/rawm/LeviathanV4Driver.test.ts`

**Interfaces:**

- Produces: `RawmError::SlotNotReported` (código `"slot-not-reported"`, sem `detail`). `LeviathanV4Session::begin_write_profile(slot: u32, settings: &MouseSettings)` passa a falhar com ele, **depois** da checagem `InvalidProfileSlot`, a menos que o último dump completo contenha uma memória com `index == slot`. Um slot relatado sem entradas conta (o coletor o cria ao ver o marcador).
- Produces: `fakeLeviathanV4().dump(slots: number[])` entrega ao driver um dump completo — o marcador de cada memória (`notify(0x14, [slot])`) e depois o terminador (`notify(0x14, [0xff])`).

- [ ] **Step 1: Testes em Rust** (`session.rs`, módulo de testes):
  - Novo `a_profile_write_waits_for_the_mouse_to_report_that_memory`: `connected()`; `begin_write_profile(2, &defaults())` é `Err(RawmError::SlotNotReported)` e `next_step()` é `Ok(None)`; depois de `held_dump(&mut session, &[0], &defaults())` continua `Err(SlotNotReported)` para o slot 2; depois de `held_dump(&mut session, &[0, 2], &defaults())` é `Ok(())`.
  - Ajustar `a_profile_write_is_not_guarded`: chamar `held_dump(&mut session, &[2], &defaults())` antes de `begin_write_profile(2, …)`.
  - `a_profile_write_beyond_the_memories_is_refused` fica como está (a checagem de faixa vem antes).
  - Em `error.rs`, no teste que trava os códigos: `assert_eq!(RawmError::SlotNotReported.code(), "slot-not-reported");`.

- [ ] **Step 2: Vetor compartilhado** — em `rawm-protocol.json`, o segundo item de `sessionWriteProfile` ("sem dump: o colchete nomeia a memória 4") passa a `"dump": ["03", "ff"]` e ao nome `"memória sem entradas relatada: o colchete nomeia a memória 4"`. O `expected` não muda — os bytes enviados são os mesmos.

- [ ] **Step 3: Testes em TypeScript**:
  - `rawmError.test.ts`, na tabela `it.each` de "erros da sessão": `['slot-not-reported', 'O mouse ainda não informou o que esta memória guarda. Aguarde um instante e grave de novo.']`.
  - `LeviathanV4Driver.test.ts`: em `brackets a profile write with the saves that commit it`, chamar `fake.dump([3])` entre `connectedDriver` e `writeProfile(4, …)`. Novo `refuses a profile write before the mouse reports the memory, without sending`: `connectedDriver` sem dump; `writeProfile(4, 'Perfil 4', settings)` rejeita com a mensagem acima; `fake.sent` tem comprimento 0.

- [ ] **Step 4: Rodar e ver falhar** — `cargo test -p gearhub-core` (erro de compilação: a variante não existe — conta como falha esperada).

- [ ] **Step 5: Implementar** — variante `SlotNotReported` com doc em português (gravar numa memória que o mouse ainda não relatou: o reset do colchete apaga o que o app não sabe nomear, e sem o relato não há o que devolver) e o código em `code()`. Em `begin_write_profile`, depois do `InvalidProfileSlot`, devolver `Err(RawmError::SlotNotReported)` quando `self.slots` não tem entrada com `index == slot`. Em `rawmError.ts`, a chave `'slot-not-reported'` com o texto do Step 3. Em `leviathanV4Harness.ts`, o método `dump(slots)` descrito em Interfaces, usando o mesmo `deliver(deliveredReports(withProtocolEnvelope([CMD_NOTIFY, 0, 0x14, …])))` de `notify` (não depender de `this`, os testes extraem os métodos).

- [ ] **Step 6: Rodar tudo** — `cargo test --workspace --all-targets`, depois `pnpm core:build`, depois `pnpm --filter @gearhub/web test`. Esperado: tudo passa. Se algum teste de componente grava perfil pelo driver real e quebrar, a correção é chamar `fake.dump([…])` antes — não afrouxar a guarda.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/protocols/rawm/error.rs packages/core/src/drivers/leviathan_v4/session.rs packages/core/vectors/rawm-protocol.json apps/web/src/core/rawmError.ts apps/web/src/core/rawmError.test.ts apps/web/src/hardware/rawm/leviathanV4Harness.ts apps/web/src/hardware/rawm/LeviathanV4Driver.test.ts
git commit -m "fix: gravar perfil exige que o mouse ja tenha relatado a memoria de destino"
```

---

### Task 5: O núcleo recusa valores que o mouse não aceita (achado 4)

**Files:**

- Modify: `packages/core/src/protocols/rawm/error.rs`
- Modify: `packages/core/src/drivers/leviathan_v4/description.rs` (`DPI`, `POLLING_RATES`, `SENSOR_ROTATION` passam a `pub(super)`)
- Modify: `packages/core/src/drivers/leviathan_v4/apply.rs` (`apply_settings`; testes)
- Modify: `apps/web/src/core/rawmError.ts`
- Test: `packages/core/src/drivers/leviathan_v4/session.rs`, `apps/web/src/core/rawmError.test.ts`, `apps/web/src/core/coreBridge.test.ts`

**Interfaces:**

- Produces: `RawmError::InvalidSetting { field: &'static str }` — código `"invalid-setting"`, `detail` = o campo no nome camelCase do editor (`"pollingRate"`, `"liftOffDistance"`, `"sensorRotation"`). DPI fora do limite usa a variante já existente `InvalidDpiStages`.
- Produces: `apply_settings(snapshot, settings)` passa a recusar, depois das checagens que já tem: `polling_rate` fora de `POLLING_RATES`; qualquer `x` ou `y` de estágio fora de `DPI.min..=DPI.max`; `lift_off_distance` fora de `lod_range()`; `sensor_rotation` fora de `SENSOR_ROTATION`.
- **Decisão registrada:** o passo de 50 do DPI **não** é imposto. Ele não corrompe nada ao ser escrito, e um mouse configurado pelo software do fabricante pode ter um estágio fora dele; recusar faria toda edição falhar. A faixa e as listas são exatamente o que `describe()` já entrega à tela como capacidade.

- [ ] **Step 1: Testes em Rust** — em `apply.rs`, `rejects_values_the_device_cannot_accept`, partindo de `settings()`; cada linha é uma asserção sobre `apply_settings(&snapshot(), &modificado)`:

| Modificação                                  | Resultado esperado                                 |
| -------------------------------------------- | -------------------------------------------------- |
| `polling_rate = 70000`                       | `Err(InvalidSetting { field: "pollingRate" })`     |
| `polling_rate = 999`                         | idem                                               |
| primeiro estágio com `x = 45050`             | `Err(InvalidDpiStages)`                            |
| primeiro estágio com `y = 99` (independente) | `Err(InvalidDpiStages)`                            |
| `lift_off_distance = 0` e `= 4`              | `Err(InvalidSetting { field: "liftOffDistance" })` |
| `sensor_rotation = 31` e `= -31`             | `Err(InvalidSetting { field: "sensorRotation" })`  |

E `accepts_the_edges_and_an_unaligned_stage`: `polling_rate = 8000`; estágios `100` e `45000`; `lift_off_distance` `1` e `3`; `sensor_rotation` `30` e `-30`; e um estágio `x = y = 1234` — todos `Ok`.
Em `session.rs`: `invalid_values_fail_before_any_byte` — `connected()`; `begin_apply` com `polling_rate: 70000` é `Err(InvalidSetting { field: "pollingRate" })` e `next_step()` é `Ok(None)`. Em `error.rs`, travar `InvalidSetting { field: "x" }.code() == "invalid-setting"` e `.detail() == Some("x")`.

- [ ] **Step 2: Testes em TypeScript** — `rawmError.test.ts`, na tabela com dado: `['invalid-setting:pollingRate', 'Ajuste fora do que o mouse aceita: pollingRate.']`. `coreBridge.test.ts`, em "estruturas através da ponte": `recusa um polling fora da lista com o texto e o código em cause` — `applySettingsToMouseParam(parseMouseParamState(leviathanV4QueryFixture), { ...defaults, pollingRate: 70000 })` lança com a mensagem acima e `cause === 'invalid-setting'`.

- [ ] **Step 3: Rodar e ver falhar** — `cargo test -p gearhub-core` (a variante não existe).

- [ ] **Step 4: Implementar** — a variante e o código; `pub(super)` nas três constantes; um `fn check_ranges(settings: &MouseSettings) -> Result<(), RawmError>` privado em `apply.rs`, chamado em `apply_settings` logo depois da escolha do estágio ativo. `rawmError.ts`: `'invalid-setting': 'Ajuste fora do que o mouse aceita: {campo}.'`.

- [ ] **Step 5: Rodar tudo** — `cargo test --workspace --all-targets`; `pnpm core:build`; `pnpm --filter @gearhub/web test`. Esperado: tudo passa, **inclusive todos os vetores compartilhados** (`paramApply` e `sessionApply` usam polling 500/4000, LOD 2/3, rotação 0/-10 e DPI 400–3200 — todos dentro das faixas). Um vetor que falhe aqui significa que a faixa escolhida está errada, não que o vetor deve mudar.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/protocols/rawm/error.rs packages/core/src/drivers/leviathan_v4/description.rs packages/core/src/drivers/leviathan_v4/apply.rs packages/core/src/drivers/leviathan_v4/session.rs apps/web/src/core/rawmError.ts apps/web/src/core/rawmError.test.ts apps/web/src/core/coreBridge.test.ts
git commit -m "feat: o nucleo recusa polling, DPI, LOD e rotacao fora do que o mouse aceita"
```

---

### Task 6: Remover `switchProfile` (achado 7)

**Files:**

- Modify: `apps/web/src/hardware/deviceDriver.ts` (método opcional `switchProfile` e seu comentário, linhas 33-34)
- Modify: `apps/web/src/store/editorStore.ts` (`loadProfile`, linhas 394-422)
- Modify: `apps/web/src/store/editorStore.onboard.test.ts:252-266`
- Modify: `apps/web/src/hardware/rawm/LeviathanV4Driver.onboard.test.ts:52-58`

**Interfaces:**

- Consumes: `applyToSession(device, settings)` local do `editorStore`.
- Produces: `DeviceDriver` sem `switchProfile`. `loadProfile` para dispositivo que não é mouse e está conectado termina em `await applyToSession(device, settings)`.
- **Corrigido em relação à auditoria:** `unregisterDeviceDriver` **fica** — nove arquivos de teste o usam para limpar o registro, e isso é uso legítimo. Só `switchProfile` é morto (nenhum driver o implementa; a nota em `LeviathanV4Driver.ts` diz que nenhum comando de troca foi verificado).

- [ ] **Step 1: Ajustar os testes antes** — em `editorStore.onboard.test.ts`, `loads the editor without switching, applying or writing to the mouse`: tirar `switchProfile` do driver e a asserção `expect(switchProfile).not.toHaveBeenCalled()`; as demais ficam. Em `LeviathanV4Driver.onboard.test.ts`, apagar o `describe('switching the active onboard slot')` inteiro (a asserção só provava a ausência de uma propriedade que deixou de existir no tipo).

- [ ] **Step 2: Remover o código** — em `deviceDriver.ts`, o método e o comentário. Em `editorStore.ts`, depois de `if (device.status === 'desconectado') return;`, substituir o bloco "A device that keeps its profiles onboard…" (busca do driver com `try`/`catch`, ramo `switchProfile`, os `cancelPendingApply`/`queuedApplies.delete` repetidos) por uma única linha `await applyToSession(device, settings);`. Os dois já foram feitos mais acima na própria função, sem `await` no meio.

- [ ] **Step 3: Verificar** — `pnpm --filter @gearhub/web test`, `pnpm --filter @gearhub/web lint`, `pnpm audit:ts`. Esperado: tudo verde. Como é remoção de código sem comportamento observável, não há teste novo — o gate é a suíte existente, o `tsc` (via `pnpm --filter @gearhub/web build`) e o knip.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hardware/deviceDriver.ts apps/web/src/store/editorStore.ts apps/web/src/store/editorStore.onboard.test.ts apps/web/src/hardware/rawm/LeviathanV4Driver.onboard.test.ts
git commit -m "refactor: remover switchProfile, que nenhum driver implementa"
```

---

### Task 7: Enxugar a ponte `coreBridge` (achado 8)

**Files:**

- Modify: `apps/web/src/core/coreBridge.ts` (linhas 52-198)
- Modify: `apps/web/src/core/coreBridge.test.ts` (descrição "RAWM core encoders")

**Interfaces:**

- Produces (todas só posicionais; `ArrayLike<number>` no lugar de `ByteArrayLike`):
  - `encodeMouseParamSnapshot(snapshot: ArrayLike<number>): Uint8Array`
  - `encodeAction(action: number, value: number): Uint8Array`
  - `encodeMouseKey(keyIds: ArrayLike<number>, modifier1: number, modifier2: number, keyType: number, keyCode: number): Uint8Array`
  - `encodeMouseFunction(keyIds: ArrayLike<number>, touchType: number, functionId: number, value: number, text: string | ArrayLike<number>): Uint8Array`
- Removidos: `RawMouseParamSnapshot`, `MouseParamSnapshot`, `RawAction`, `RawMouseKey`, `RawMouseFunction`, `ByteArrayLike`, `isByteArrayLike`, `snapshotBytes`. Mantidos: `copyBytes`, `textBytes`, e `CoreStatus`.
- Os nove exports sem chamador de produção (`encodeMouseKey`, `encodeMouseFunction`, `actionForKey`, `actionForFunction`, `leviathanButtonId`, `applySettingsToMouseParam`, `OnboardConfigCollector`, `decodeOnboardEntry`, `parseRawmIdentity`) **ficam**: são o gancho dos vetores compartilhados no vitest. Só os apelidos e sobrecargas saem.

- [ ] **Step 1: Migrar os testes primeiro** (passam antes e depois, é refatoração): `encodeMouseParamSnapshot(Uint8Array.from([0x10, 0x20, 0x30, 0xfe, 0xed]))`; `encodeAction(0x34, 0x01020304)`; `encodeMouseKey([0x12, 0x34], 0x56, 0x78, 0x01, 0x9a)`; `encodeMouseFunction([0xaa], 0x02, 0x10, 0x1234, 'F')`. Apagar `always emits zero for the reserved mouse-key byte` (testava um campo legado `keyEvent` que a assinatura posicional não tem; o byte zero já está travado por `encodes_mouse_key_in_rawm_field_order` em `lib.rs`) e o import `type RawMouseKey`.

- [ ] **Step 2: Rodar** — `pnpm --filter @gearhub/web exec vitest run src/core/coreBridge.test.ts`. Esperado: PASS (as sobrecargas ainda existem).

- [ ] **Step 3: Remover as sobrecargas e os tipos** em `coreBridge.ts`, deixando só as assinaturas acima. `writeProbe.ts` já chama `encodeAction(a, b)` e `encodeMouseParamSnapshot(Uint8Array)` na forma nova — nenhuma mudança lá.

- [ ] **Step 4: Verificar** — `pnpm --filter @gearhub/web test`, `pnpm --filter @gearhub/web build` (o `tsc -b` acusa qualquer chamador esquecido) e `pnpm audit:ts` (o knip acusa tipo exportado sem uso). Esperado: verde.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/core/coreBridge.ts apps/web/src/core/coreBridge.test.ts
git commit -m "refactor: ponte so com assinaturas posicionais, sem apelidos de snapshot"
```

---

### Task 8: Regras do knip e comentários da página de diagnóstico (achados 11 e 12)

**Files:**

- Modify: `knip.jsonc:20-25`
- Modify: `apps/web/vite.config.ts:12-13`
- Modify: `apps/web/src/diagnostico.tsx` (comentário acima de `void ensureCoreReady()`)

**Interfaces:** nenhuma.

- [ ] **Step 1: Apagar do `knip.jsonc` o bloco `ignoreIssues` inteiro** (as duas regras: "Skeleton kept for the upcoming WebHID implementation" sobre `WebHidTransport.ts` — arquivo vivo — e "Public while the store API is still being shaped" sobre os tipos de `deviceStore.ts`).

- [ ] **Step 2: Rodar** — `pnpm audit:ts`. Esperado: no máximo `ConnectionState` exportado e sem uso fora de `deviceStore.ts`. Se aparecer, tirar o `export` dele. Se aparecer qualquer outra coisa, tratar como achado novo: reportar, não silenciar com outra regra.

- [ ] **Step 3: Corrigir os dois comentários** para dizer o que é verdade: a página de diagnóstico é uma entrada própria **para nunca montar o editor** (que aplica ao hardware assim que um controle se move). Ela só consulta até o usuário marcar "Entendo que isto escreve no mouse"; depois, cada sonda de escrita é um clique explícito, e `probeProfileWrite` chega à flash. Apagar a frase "read-only is a structural property".

- [ ] **Step 4: Verificar e commitar** — `pnpm format:check` e `pnpm audit:ts`.

```bash
git add knip.jsonc apps/web/vite.config.ts apps/web/src/diagnostico.tsx apps/web/src/store/deviceStore.ts
git commit -m "chore: tirar regras velhas do knip e corrigir comentarios da pagina de diagnostico"
```

(`deviceStore.ts` só entra no `git add` se o Step 2 tiver exigido tirar o `export`.)

---

### Task 9: Cache das ferramentas cargo no CI (achado 9)

**Files:**

- Modify: `.github/workflows/verify.yml:30-34`

**Interfaces:** nenhuma.

- [ ] **Step 1: Implementar** — antes de `Install cargo-machete`, acrescentar:

```yaml
- name: Cache cargo tools
  id: cargo-tools
  uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/cargo-machete
      ~/.cargo/bin/wasm-pack
    key: cargo-tools-${{ runner.os }}-machete-0.9.2-wasm-pack-0.15.0
```

e `if: steps.cargo-tools.outputs.cache-hit != 'true'` nos dois passos `cargo install`. As versões na chave **têm** de acompanhar as dos comandos `cargo install` (mudar uma sem a outra serve binário velho).

- [ ] **Step 2: Verificar** — só no CI: abrir o PR, olhar o job `Verify` na primeira execução (cache miss, instala) e numa segunda execução do mesmo commit (cache hit). Esperado: na segunda, os dois passos `cargo install` aparecem como pulados e o job é vários minutos mais curto. **Isto não pode ser provado localmente.**

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/verify.yml
git commit -m "ci: cachear cargo-machete e wasm-pack entre execucoes"
```

---

### Task 10: Higiene do repositório (achados 6 e 10) — **precisa do seu OK antes do Step 3**

**Files:**

- Delete (não versionado): `%SystemDrive%/`
- Modify: `.gitignore`
- Untrack: `apps/web/.impeccable/**/*.png`

**Interfaces:** nenhuma.

- [ ] **Step 1: Pasta `%SystemDrive%/`** — confirmar que só tem diretórios vazios: `find '%SystemDrive%' -type f | wc -l` → esperado `0`. Só então `rm -r '%SystemDrive%'`. Se der mais de zero, parar e perguntar.

- [ ] **Step 2: Medir antes de mexer nos PNGs** — `git ls-files apps/web/.impeccable | grep -c '\.png$'` e `git grep -n '\.png' -- apps/web/.impeccable ':!*.json'`. O segundo mostra se algum arquivo versionado depende dos PNGs (o gerador da galeria, por exemplo); se depender, registrar que a galeria precisa dos arquivos locais para renderizar.

- [ ] **Step 3: (precisa de OK) Destrackear sem apagar do disco**

```bash
git ls-files -z 'apps/web/.impeccable/*.png' | xargs -0 git rm --cached -q --
echo 'apps/web/.impeccable/**/*.png' >> .gitignore
```

Verificar: `git ls-files apps/web/.impeccable | grep -c '\.png$'` → `0`, e os arquivos continuam em disco. **O histórico do git continua guardando os PNGs**: um clone completo ainda os baixa. Reescrever o histórico é destrutivo e **não** faz parte deste plano. O ganho é o checkout raso do CI (`actions/checkout@v4` usa profundidade 1) e as árvores novas.

- [ ] **Step 4: Não tocar, perguntar** — `graphify-out/` (7 arquivos gerados e versionados, 2,5 MB; `.cursor/rules/graphify.mdc` pode depender deles) e `ui-study-spotifast-monocode-2026-10-07.md` (arquivo solto de 10 KB que parece seu). O plano não os remove.

- [ ] **Step 5: Commit** (só se o Step 3 foi aprovado)

```bash
git add .gitignore
git commit -m "chore: parar de versionar os PNGs de mock do impeccable"
```

---

### Task 11: Gate final e confirmação no hardware

**Files:** nenhum.

- [ ] **Step 1: Gate** — `pnpm verify`. Esperado: `format:check`, `lint`, `test`, `build` e `audit` (knip, dependency-cruiser, cargo-machete) passam. Qualquer falha é corrigida na tarefa de origem, não aqui.

- [ ] **Step 2: Provar que nenhum byte mudou** — `cargo test -p gearhub-core --test vectors` e `pnpm --filter @gearhub/web exec vitest run src/hardware/rawm/vectors.test.ts`. Esperado: passam; a única mudança nos vetores é o `dump` do segundo `sessionWriteProfile`, e o `expected` dele é o mesmo de antes.

- [ ] **Step 3: Confirmação no mouse (manual, feita por você — nenhum teste unitário alcança o firmware)**. `pnpm dev`, com o Leviathan V4 ligado:
  1. Conectar, esperar ~2 s, mudar o polling: aplica.
  2. Gravar na memória 4: grava; uma tecla com macro fora do editor continua com a macro.
  3. Desligar e religar o receptor, clicar em "Reconectar": o aparelho volta, e a edição que falhou é repetida sozinha.
  4. Apertar o botão de DPI do mouse e trocar de memória: a tela acompanha; a lista de perfis mostra os mapeamentos reais do mouse, não os de fábrica.
  5. Abrir `#/dispositivo/%E0%A4%A/dpi`: abre a home.

- [ ] **Step 4: Abrir o PR** só depois dos Steps 1-3, com o resultado de cada um na descrição.
