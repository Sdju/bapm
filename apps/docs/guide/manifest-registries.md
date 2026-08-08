# Registries и marketplace в манифесте

Редкие поля consumer day-to-day. Обзор: [манифест](/guide/config-manifest).

## `registries`

Именованный mapping. Ключ `default` — **не URL**, а имя уже объявленного registry.

| Форма значения | Поля                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| строка         | HTTP(S) URL                                                                        |
| объект         | обязательный `url`; опционально `insecure`, `aliases`; `token` в YAML **запрещён** |

`http://` без `insecure: true` — только exempt-хосты (loopback / RFC1918).

```yaml
registries:
  default: my-reg
  my-reg:
    url: https://registry.example.com
    aliases:
      - registry.example.com
  local-http:
    url: http://127.0.0.1:4873
    insecure: true
```

Experimental resolve/install и `publish` включаются через `BAPM_EXPERIMENTAL_REGISTRIES=1`. См. [publish](/reference/publish).

## `marketplace:` (authoring)

Блок в `bapm.yml` для `bapm marketplace …` / `bapm pack`. Валидируется отдельно от consumer Manifest parse.

Типичные ключи: `owner`, `build` (`tagPattern`), `outputs`, `packages` (`name` + `source`, …). Имя/описание/версия marketplace по умолчанию наследуются с top-level.

Команды: [marketplace](/reference/marketplace). Сценарий: [Marketplace pack](/guide/situations/marketplace-pack).

## Что обычно не правят каждый день

- `default_host` — retained в модели; отдельной UX-команды нет
- Top-level `workspaces` — **нельзя** (`OpenAPM v0.1 rejects…`)
- Неизвестные top-level и `x-*` — сохраняются для rewrite, не обязаны быть в схеме дня

## Типичные ошибки

| Симптом                                          | Что проверить                            |
| ------------------------------------------------ | ---------------------------------------- |
| `Registry … uses http:// without insecure: true` | `insecure: true` или HTTPS / exempt host |
| `OpenAPM v0.1 rejects top-level "workspaces"`    | Уберите `workspaces`                     |
