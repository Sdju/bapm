# Registries и маркетплейс

Эти поля нужны, если пакеты хранятся в приватном registry или если вы публикуете собственный маркетплейс плагинов. Для пакетов из git они не требуются.

## `registries`

::: warning Экспериментально
Установка из registry и `bapm publish` работают только с переменной окружения `BAPM_EXPERIMENTAL_REGISTRIES=1`.
:::

```yaml
registries:
  default: company # имя registry по умолчанию, не URL
  company:
    url: https://registry.example.com
    aliases:
      - registry.example.com
  dev:
    url: http://127.0.0.1:4873
    insecure: true
```

| Поле       | Значение                                                                              |
| ---------- | ------------------------------------------------------------------------------------- |
| `url`      | Адрес registry. Можно записать registry строкой: `company: https://…`                 |
| `insecure` | Разрешить `http://`. Без него `http://` допустим только для localhost и частных сетей |
| `aliases`  | Другие имена хоста, под которыми registry встречается в зависимостях                  |

Токен в манифест не пишется: bapm отвергает поле `token`. Передайте его через переменную окружения — она используется и при `install`, и при `publish`:

- `BAPM_REGISTRY_<NAME>_TOKEN` — для конкретного registry. `<NAME>` — имя registry в верхнем регистре, прочие символы заменяются на `_`: для `my-registry` это `BAPM_REGISTRY_MY_REGISTRY_TOKEN`;
- `BAPM_REGISTRY_TOKEN` — общий, если именной не задан.

Как сослаться на пакет из registry: [Зависимости](/guide/manifest-dependencies#registry). Личные registry можно объявить в [`bapm.local.yml`](/guide/manifest-overlay).

## `marketplace`

Блок описывает маркетплейс, который вы публикуете: владельца, список пакетов, шаблон тегов. По нему `bapm pack` собирает `marketplace.json` для Claude Code и Codex.

Руками этот блок обычно не пишут:

```bash
bapm marketplace init
bapm marketplace package add …
bapm marketplace check
```

Основные ключи: `owner`, `packages` (у каждого `name` и `source`), `build.tagPattern`, `outputs`. Имя, описание и версия по умолчанию берутся из корня `bapm.yml`.

Сценарий: [Сборка маркетплейса](/guide/situations/marketplace-pack). Команды: [marketplace](/reference/marketplace).

## Частые ошибки

| Сообщение                                        | Что делать                                             |
| ------------------------------------------------ | ------------------------------------------------------ |
| `Registry … uses http:// without insecure: true` | Используйте HTTPS или добавьте `insecure: true`        |
| Пакет из registry не находится                   | Проверьте, что задана `BAPM_EXPERIMENTAL_REGISTRIES=1` |
