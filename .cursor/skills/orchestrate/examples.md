# Orchestrate — примеры

## Фича с OpenSpec

Пользователь:

```
/orchestrate добавить парсинг bapm.yml из файла на диске в @bapm/core
```

Parent:

1. Todo: plan → acceptance → apply → accept → merge → deliver
2. Task propose с шаблоном plan — propose
3. По report → Task acceptance
4. → apply → accept → merge
5. Deliver из summary

## Неясный scope

```
/orchestrate улучшить DX установки
```

Parent → Task explore; если субагент `next: propose` — следующий Task propose; иначе спросить user.

## Без OpenSpec

```
/orchestrate без openspec: поправить текст help CLI
```

Plan-субагент без `openspec new`; acceptance всё равно отдельными тестами если есть наблюдаемое поведение; для чистой строки help — acceptance может быть минимальным CLI smoke, RED→GREEN сохраняется.
