# Remote policy discovery не подключено как в спеке

**Статус:** открыто (провайдер есть в core, CLI его не вызывает)  
**Класс:** долг спеки / неполная реализация  
**Важность:** средняя — локальная policy работает, но заявленный `github-owner-dotgithub` в реальном CLI всегда absent: org-policy молча не применяется к install-гейту.  
**Проверено:** 08-11-2026, working tree

## Суть

Спека `policy-remote-discovery` требует поставлять провайдер `github-owner-dotgithub`: он берёт `origin` (или единственный remote), проверяет, что хост совпадает с implementation-default, и загружает `<owner>/.github/apm-policy.yml`. ADO и multi-candidate каскады при этом явно out of scope.

В core провайдер реализован и покрыт тестами, но только с инжектированным `fetchPolicyUrl`/`httpGet`. Если fetcher не передан, `discoverGithubOwnerDotgithub` возвращает `null` — «сети без инжектора нет». CLI ни в `policy status`, ни в install не передаёт `fetchPolicyUrl`/`policyPorts`, поэтому в реальном запуске remote-провайдер не делает запрос и не находит org policy.

Исходная карточка говорила, что local + github-owner-dotgithub «заявлено и реализовано». Точнее: реализовано в core как порт, но не подключено в CLI; `bapm policy status` в репозитории с github-origin не видит org policy. ADO — действительно осознанный scope out.

## Влияние

- **Сценарий:** организация публикует `acme/.github/apm-policy.yml` с `deny`, проект клонирован с `origin=https://github.com/acme/app.git`, локального policy-файла нет.
- **Кого задевает:** команда/CI, которая рассчитывает на org-wide governance; security-ревью.
- **Последствие:** `bapm policy status` показывает `absent`, install-гейт не видит org deny; политика применяется только если файл положили в репозиторий локально.
- **Частота:** каждый install/status в проекте без локального policy, но с github-origin; при наличии локального файла remote вообще не нужен.
- **Обходной путь:** положить `bapm-policy.yml` в корень проекта или передать `--policy <path>`.

## Состояние

| Источник     | Позиция                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| APM          | Более длинные cascade (в т.ч. Azure DevOps) в полном продукте.                                                |
| OpenAPM      | Расширяемые providers; не все обязательны для claim.                                                          |
| Спека bapm   | `policy-remote-discovery`: provider MUST ship; ADO/`.apm`/`_apm` cascades MUST NOT be required.               |
| Код bapm     | Providers: `local`, `github-owner-dotgithub`; remote требует инжектированный fetch.                           |
| CLI          | `runPolicyStatus` и install не передают fetch/policyPorts → remote-провайдер всегда absent.                   |
| Документация | `reference/policy.md`, `CONFORMANCE.md`: ADO / multi-candidate out of scope.                                  |

## Проверка

| Артефакт | Где смотреть                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Policy/providers.ts:160` — `if (!fetcher) return null` (production без инжектора).              |
| Код      | `packages/core/src/modules/Policy/constants.ts:20` — default providers `local`, `github-owner-dotgithub`.                  |
| CLI      | `packages/cli/src/modules/Policy/services/runPolicy.ts:170` — `runPolicyStatus({ cwd, policyPath, policy, noPolicy })`, без fetch. |
| CLI      | `packages/cli/src/modules/Install/services/runInstall.ts:540` — install вызывает `registerManifestIntegrationsFromCwd`; policy-порты не передаются. |
| Тесты    | `packages/core/tests/policy/remote-discovery.test.ts:87-111` — провайдер проверяется с подставным `fetchPolicyUrl`.        |
| Спека    | `openspec/specs/policy-remote-discovery/spec.md:23-27` — provider MUST ship; `:25` — ADO out of scope.                     |
| Conformance | `CONFORMANCE.md:131-133`, `tests/spec-conformance/checklist.yml:490-517` — pl-010/011/012 заявлены active.              |

Воспроизведение:

```bash
mkdir -p /tmp/bapm-policy && cd /tmp/bapm-policy
git init -q && git remote add origin https://github.com/acme/app.git
printf 'name: demo\nversion: 0.1.0\n' > bapm.yml
bapm policy status --json
```

Ожидание: status пытается получить `https://github.com/acme/.github/apm-policy.yml` (found/absent/error с сетевым диагнозом).  
Факт: `{"outcome":"absent","provider":"none",...}` — remote-провайдер не вызывался; сетевого запроса нет.

## Вариации

1. Подключить fetch в CLI (минимальный `https` через `fetchPolicyUrl`) и покрыть e2e-тестом status/install — рекомендуется.
2. Вычистить провайдер из спеки и conformance, оставить только local — честнее, но теряется заявленный org-слой.
3. Оставить как есть — provider числится active, но в CLI мёртв.

## Рекомендация

Вариант 1. Передать в `runPolicyStatus` и install единый порт `fetchPolicyUrl` (Node `fetch` с таймаутом/редиректами по правилам credential-host-class), затем e2e: github-origin + mock org-policy → `outcome: found`, `provider: github-owner-dotgithub`; install с org deny → fail-closed. Оценка M (1–2 дня).

Критерии закрытия:

- [ ] `bapm policy status` в репозитории с github-origin делает запрос к `<owner>/.github/apm-policy.yml`.
- [ ] install-гейт применяет org deny до durable-записей.
- [ ] Есть e2e-тест без ручного инжектора; пути в conformance указывают на существующие файлы.

## Поведение сейчас

`bapm policy status` видит только репозиторный `apm-policy.yml`/`bapm-policy.yml` или явный `--policy`. Org policy с github.com owner не ищется, хотя провайдер и его тесты существуют. Чужие хосты и ADO cascade не ищутся — это соответствует спеке.

## Связанные

- [no-policy-disables-org.md](./no-policy-disables-org.md) — `--no-policy` и org-deny.
- [policy-file-deny-only.md](./policy-file-deny-only.md) — что вообще умеет файл политики.
