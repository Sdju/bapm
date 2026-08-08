# Self-commit (фаза → git → report)

Вызывается **тем же** фазовым агентом после успешной работы, **до** structured report. Отдельный commit-субагент **запрещён**.

Сначала прочитай `.cursor/skills/orchestrate/branching.md`.

## Когда коммитить

| Фаза                         | Коммит?                  | `type`                    |
| ---------------------------- | ------------------------ | ------------------------- |
| plan (propose, есть файлы)   | да                       | `docs` или `chore`        |
| plan (explore, без файлов)   | нет                      | —                         |
| acceptance                   | да                       | `test`                    |
| apply                        | да                       | `feat` или `fix`          |
| accept                       | только если правил файлы | `test` / `docs`           |
| promote                      | да                       | `test` или `refactor`     |
| merge (archive)              | да                       | `docs` или `chore`        |
| merge (ship: push/PR)        | нет нового коммита*      | —                         |
| canvas / apm-expert criteria | validate                 | нет (вне git / knowledge) |

\* Ship пушит уже сделанные коммиты и открывает PR; новых commit не создаёт, если tree чистый.

При `status: fail|blocked` — **не** коммить; `commitSha: —`.

При `ok|pass` и ожидаемом коммите: нет изменений для stage → `commitSha: —` допустим; иначе после успешного commit обязателен sha. Нет sha при ожидаемом коммите и грязном tree фазы → считай фазу `fail`.

## Ветка (обязательно до commit)

1. `git branch --show-current`.
2. Если `master` или `main` → `git checkout -b orch/<changeName>` (changeName / slug от parent; без пробелов).
3. Если уже feature-ветка — оставайся; запиши `branchName` в report.
4. **Никогда** не коммить на `master`/`main` (hooks отклонят; политика репо).

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

6. **Фазовые** коммиты: не `push`. Не `--no-verify` / `--amend` / force. Не менять `git config`.
7. Push / `gh pr create` — **только** шаг ship в `orch-merge` (см. branching.md). Pre-push хук гоняет `vp check` — при fail почини или `blocked`, не обходи хук.
8. После коммита: `git status` → в отчёт `commitSha` (полный), `commitMessage`, `branchName`.

## Порядок

`ensure branch → работа фазы → (self-commit если нужно) → structured report`  
Для merge: `archive + self-commit → ship (push/PR) → report` (`prUrl` в report).
