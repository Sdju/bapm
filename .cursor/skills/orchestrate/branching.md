# Branching (feature branch + PR)

Репозиторий **запрещает** прямые коммиты и push в `master`/`main` (Vite+ hooks + GitHub branch protection). Оркестрация идёт только через feature-ветку и PR.

## Имя ветки

- Предпочтительно: `orch/<changeName>` (kebab change / мини-plan slug).
- Если уже на не-default ветке (продолжается PR / user branch) — **оставайся** на ней; не создавай вложенную без указания parent.
- На `master`/`main` перед первым коммитом фазы: `git checkout -b orch/<changeName>` (от текущего HEAD).

## Кто что делает

| Момент                        | Агент                                        | Действие                                                                                      |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Старт propose / первый коммит | `orch-plan` (+ любая фаза через self-commit) | ensure feature branch                                                                         |
| Каждая фаза с коммитом        | фазовый агент                                | self-commit **только** на feature branch; **не** push                                         |
| После OpenSpec archive        | `orch-merge` (шаг **ship**)                  | `vp check` при необходимости, `git push -u origin HEAD`, `gh pr create` если нет открытого PR |
| Deliver                       | parent                                       | в отчёт: `branchName`, `prUrl`, sha фаз; **не** merge PR сам                                  |

## Запреты

- Не `git push` origin `master`/`main`.
- Не `gh pr merge` / не squash в master без явной просьбы user (после deliver — решение user).
- Не `--no-verify` (pre-commit / pre-push: запрет master + `vp check`).
- Не переключайся на master «чтобы закоммитить».

## Report fields

- `branchName: <current branch>`
- `prUrl: <url или —>` (заполняет ship в `orch-merge`; раньше — `—`)
