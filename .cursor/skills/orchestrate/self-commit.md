# Self-commit (фаза → git → report)

Вызывается **тем же** фазовым агентом после успешной работы, **до** structured report. Отдельный commit-субагент **запрещён**.

## Когда коммитить

| Фаза | Коммит? | `type` |
|------|---------|--------|
| plan (propose, есть файлы) | да | `docs` или `chore` |
| plan (explore, без файлов) | нет | — |
| acceptance | да | `test` |
| apply | да | `feat` или `fix` |
| accept | только если правил файлы | `test` / `docs` |
| promote | да | `test` или `refactor` |
| merge | да | `docs` или `chore` |
| canvas / apm-expert criteria|validate | нет (вне git / knowledge) | — |

При `status: fail|blocked` — **не** коммить; `commitSha: —`.

При `ok|pass` и ожидаемом коммите: нет изменений для stage → `commitSha: —` допустим; иначе после успешного commit обязателен sha. Нет sha при ожидаемом коммите и грязном tree фазы → считай фазу `fail`.

## Правила git

1. `git status` / `git diff` / `git log -5 --oneline` (стиль сообщений).
2. Stage **только** allowlist своей фазы (см. агент). Чужой dirty, `.samples/`, canvas вне репо, секреты (`.env`, credentials) — не трогать.
3. Conventional Commits: `type(scope): summary` (+ body по необходимости). Scope: пакеты и/или `changeName`.
4. Один коммит = одна фаза. Не мешать фазы.
5. Commit через HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type(scope): summary

EOF
)"
```

6. Не `push`. Не `--no-verify` / `--amend` / force. Не менять `git config`.
7. После коммита: `git status` → в отчёт `commitSha` (полный) и `commitMessage`.

## Порядок

`работа фазы → (self-commit если нужно) → structured report`
