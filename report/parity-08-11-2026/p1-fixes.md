# P1 — исправления паритета

Каждый пункт — отдельный кандидат в change. Evidence проверен по коду; runtime-проверки отмечены.

## 1. Target tokens

**Статус:** подтверждено (CLI-репро 08.11.2026)  
**Проблема:** bapm поставляет `@b-apm/integration-kiro` и `@b-apm/integration-grok-build`, но manifest-валидатор не принимает их в `target`/`targets`/`active`.

**Repro:**

```bash
printf 'name: p\nversion: 0.1.0\ntarget: kiro\n' > bapm.yml
bapm lock   # exit 1: Invalid target token "kiro" (mf-005)
```

`grok-build` — то же. `vscode`/`agents` парсятся, но не нормализуются в `copilot`, затем падают на registry lookup.

**Evidence:** `packages/core/src/modules/Manifest/targets.ts:7-21` (canonical set без kiro/grok-build), `Manifest/parse.ts:514-521`, `Install/runInstall.ts` (assert registered target).

**Влияние:** документированные хосты недоступны через manifest; работает только `--target kiro` (forced), что маскирует баг в CI.

**Fix:** добавить `kiro`, `grok-build` в canonical set; нормализовать `vscode`/`agents` → `copilot` до registry lookup. Тесты: parse `target`/`targets`/`active` для 11 ids + aliases.

**Критерии:** `bapm lock` и `install` проходят для `target: kiro|grok-build`; `vscode`/`agents` дают `copilot`; неизвестный id по-прежнему fail-closed.

---

## 2. MCP secret bake

**Статус:** подтверждено статически; runtime не проверялся  
**Проблема:** `install` по умолчанию бейкает `${VAR}` в literal для всех хостов, кроме `mcpEnvMode: "translate"` (Copilot, Kiro). Cursor и OpenCode получают реальные секреты в `.cursor/mcp.json` / `opencode.json`.

**Evidence:** `packages/core/src/modules/Install/runInstall.ts:1274` (`translate` только при флаге), `packages/integration-cursor/src/createCursorIntegration.ts` (нет `mcpEnvMode`), `integration-opencode` (нет), APM 0.33 #3116 / 0.35 #3303.

**Влияние:** секрет лежит на диске, ротация ломает конфиг; lock хранит placeholder, host — literal. Это регрессия относительно APM.

**Fix:** `mcpEnvMode: "translate"` для Cursor/OpenCode; писать native `${env:VAR}` / `{env:VAR}`; `{bake:NAME}` резолвить по-прежнему. Добавить e2e: `${TOKEN}` остаётся placeholder в host, literal — только при `{bake:}`.

**Критерии:** Cursor/OpenCode не содержат literal env-секретов; lock и host согласованы по смыслу; translate-тесты зелёные.

---

## 3. Codex headers

**Статус:** подтверждено статически  
**Проблема:** `createCodexIntegration` не переносит `headers` в Codex-native поля.

**Evidence:** `packages/integration-codex/src/createCodexIntegration.ts:437-455` (url/env только), APM `adapters/client/codex.py:440-483` (`http_headers`, `env_http_headers`, `bearer_token_env_var`).

**Влияние:** remote MCP с Authorization получает 401; при этом bapm уже умеет `headers` в manifest и bake.

**Fix:** маппить authored/baked headers в `http_headers`; env-ссылки — в `env_http_headers`/`bearer_token_env_var`, не literal. Тест на remote Codex MCP с header.

**Критерии:** Codex config содержит header в native-форме; секрет не бейкается; lock хранит placeholder.

---

## 4. Registry MCP

**Статус:** подтверждено статически; runtime не проверялся  
**Проблема:** manifest `mcp: [{name, registry: ...}]` без command/url проходит collect; Cursor пишет `{type:"stdio"}` без command, потому что `registry` исключён из rest-полей.

**Evidence:** `packages/core/src/modules/Mcp/collect.ts:11-20,125-137`, `packages/integration-cursor/src/createCursorIntegration.ts:255-312`.

**Влияние:** невалидный сервер в host-конфиге и lock; пользователь не понимает, почему MCP не работает.

**Fix:** fail-closed `MCP_REGISTRY_UNSUPPORTED` до записи, либо реализовать registry lookup (APM `install/mcp/registry.py`). Минимум — диагностика с именем сервера и подсказкой указать `command`/`url`.

**Критерии:** registry-only entry даёт понятную ошибку и ничего не пишет; mix direct + registry не ломает direct.

---

## 5. Frozen under-record

**Статус:** подтверждено статически  
**Проблема:** frozen проверяет lock, direct pins и хеши **присутствующих** записей, но не падает, если lock не записывает файлы, которые install собирается развернуть. Локальные пакеты не хешируются.

**Evidence:** `packages/core/src/modules/Install/frozen.ts:16-70`, `Install/runInstall.ts:339`, `Install/deployedInventory.ts:62-118`; APM 0.34 #2379/#2384, 0.35 #3236.

**Влияние:** CI зелёный, но deploy-ит файлы вне lock; правка локального пакета не ловится `--frozen`.

**Fix:** (a) сравнить would-be deployed set с lock и падать с именами путей; (b) local snapshot `content_hash` + проверка при frozen. Тест: lock без inventory + новый файл → fail до записи.

**Критерии:** frozen не деплоит незаписанные пути; local drift ловится; обычный install обновляет baseline.

---

## 6. Local lock wire

**Статус:** подтверждено статически  
**Проблема:** bapm local-строка содержит `repo_url: local:<rel>` + `path`; APM ждёт `_local/<name>`, `local_path`, `declaring_parent`, `content_hash`, `depth`, `resolved_by`, `package_type`, `is_dev`.

**Evidence:** `packages/core/src/modules/Resolver/resolveAndLock.ts:306-327,355-368`, `Lockfile/serialize.ts:17,102-108`; APM `deps/lockfile.py:457-500,1042-1044`, `lockfile-spec.md:286-330`.

**Влияние:** cross-tool lock не взаимозаменяем; APM теряет bapm local rows; bapm не видит APM `_local/*`; нет drift evidence.

**Fix:** писать APM-совместимые local-поля для local-записей (при сохранении текущего `repo_url`/`path` как alias), читать `_local/*`; тест round-trip APM→bapm→APM.

**Критерии:** APM читает bapm lock без потери local-зависимостей; bapm читает `_local/*`; frozen/audit видят content hash.

---

## 7. Replace и lock v3

**Статус:** подтверждено статически  
**Проблема:** root `replace:` неизвестен bapm и молча игнорируется; `lockfile_version: "3"` отвергается `LOCKFILE_UNSUPPORTED_VERSION`.

**Evidence:** `packages/core/src/modules/Manifest/parse.ts:87-99` (unknown keys retained), `Lockfile/parse.ts:8,54-65`; APM `models/dependency/replacement.py`, `deps/lockfile.py:45`.

**Влияние:** проект с `replace:` ставит upstream вместо локального checkout/fork — **неверный код** без ошибки. v3 lock нельзя прочитать.

**Fix:** минимум — fail-closed с `MANIFEST_REPLACE_UNSUPPORTED` и `LOCKFILE_V3_UNSUPPORTED` (не generic). Полный — read/emit `replacements` + v3 под candidate-gate; контракт APM сам не ratified.

**Критерии:** `replace:` не игнорируется; v3 даёт actionable diagnostic; решение о full support зафиксировано.

---

## 8. TLS/CA

**Статус:** подтверждено grep  
**Проблема:** bapm не документирует и не обрабатывает корпоративные CA; APM 0.34 добавил `APM_EXTRA_CA_BUNDLE`.

**Evidence:** `grep -rn "NODE_EXTRA_CA_CERTS\|EXTRA_CA\|CA_BUNDLE" packages apps/docs` — пусто; APM `core/tls_trust.py:43-199`.

**Влияние:** private registry / TLS-inspecting proxy падает без понятной инструкции.

**Fix:** документировать `NODE_EXTRA_CA_CERTS` (работает для Node fetch) и/или добавить additive `BAPM_EXTRA_CA_BUNDLE` с валидацией PEM и disable switch.

**Критерии:** docs содержат рецепт; ошибка TLS называет переменную; тест с self-signed CA (локальный).
