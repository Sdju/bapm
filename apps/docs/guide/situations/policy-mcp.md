# US-04: Policy блокирует MCP

## Когда …

Install/материализация MCP не пишет сервер в `.cursor/mcp.json` (unapproved / deny / project policy), либо нужно явно разрешить или запретить пакет локально.

### Цель

Понять effective policy, выдать user-local allow/deny и повторить install, не правя project yml ради grants.

### Шаги

1. Посмотрите discovery / enforcement (read-only):

```bash
bapm policy status
# JSON:
bapm policy status --json
# non-zero, если нет usable policy:
bapm policy status --check
```

2. Если MCP из зависимости не попал в `.cursor/mcp.json` из‑за отсутствия allow — одобрите **имя пакета** в user store:

```bash
bapm approve <package-name>
```

Запись идёт в `~/.bapm/config.json` (`executables.allow`), **не** в `bapm.yml` / `apm.yml`.

3. Чтобы явно запретить пакет у себя:

```bash
bapm deny <package-name>
```

4. Повторите install с Cursor:

```bash
bapm install --target cursor
```

5. Project policy-файл (`apm-policy.yml` / `bapm-policy.yml` или `--policy <path>`) может задавать `executables.allow` на уровне репозитория. Escape hatch на install: `--no-policy` или `BAPM_POLICY_DISABLE=1` (ослабляет checks — только осознанно).

Транзитивный MCP по умолчанию не деплоится: нужен `--trust-transitive-mcp` на [install](/reference/install).

### Ожидаемый результат

- `policy status` сообщает source / outcome без мутаций манифеста и lock.
- `approve` / `deny` меняют только `~/.bapm/config.json`.
- После allow + install eligible MCP появляется в `.cursor/mcp.json`; при deny / withhold — записи нет и есть fail-closed сигнал в выводе.

Справка: [policy / approve / deny](/reference/policy).

### Если не сработало

- `approve` / `deny` без имени → help и ошибка; передайте `<package-name>`.
- Approve сделали, но MCP всё ещё нет → проверьте, что dep в `dependencies.mcp` (прямые) или нужен `--trust-transitive-mcp`; что активен `--target cursor`; что имя пакета совпадает с grant.
- Ожидали, что approve попадёт в git → нет: grants user-local; для команды используйте project policy-файл в репозитории.
- `policy` без `status` → usage и ошибка; нужна подкоманда `status`.
