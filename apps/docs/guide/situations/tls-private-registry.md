# Private registry и TLS

## Ситуация

`bapm install`, `bapm publish` или `bapm self-update` не могут подключиться к registry по HTTPS. В ошибке видно одно из:

- `fetch failed`;
- `self-signed certificate in certificate chain`;
- `unable to get local issuer certificate`;
- `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `CERT_HAS_EXPIRED`.

Обычно это приватный registry с внутренним CA или корпоративный TLS-inspecting proxy (MITM). bapm ходит в registry через Node `fetch`/undici и доверяет тому же trust store, что и Node.

::: warning Не отключайте проверку сертификата
Не используйте `NODE_TLS_REJECT_UNAUTHORIZED=0`: это отключает проверку для всего процесса и маскирует подмену. Добавьте доверенный CA, а не отключите TLS.
:::

## Вариант 1: `NODE_EXTRA_CA_CERTS` (Node/undici)

Node читает `NODE_EXTRA_CA_CERTS` при старте и **добавляет** сертификаты из PEM к встроенному trust store. Это работает для registry, self-update и любых других HTTPS-запросов процесса.

```bash
# один PEM-файл с одним или несколькими сертификатами
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/corp-root-ca.pem
bapm install

# CI
NODE_EXTRA_CA_CERTS="$PWD/ci/corp-root-ca.pem" bapm install --frozen
```

Переменная должна быть задана **до** запуска `bapm`: изменение в уже запущенном процессе Node не подхватит. Путь указывает на файл, а не на каталог. Если в файле несколько сертификатов, просто сложите PEM-блоки подряд.

## Вариант 2: `BAPM_EXTRA_CA_BUNDLE` (только bapm, additive)

`BAPM_EXTRA_CA_BUNDLE` — путь к PEM-файлу, который bapm читает при первом HTTPS-запросе к registry. Сертификаты **добавляются** к текущему default CA store Node; системный trust store и встроенные корни не заменяются.

```bash
export BAPM_EXTRA_CA_BUNDLE=/etc/ssl/certs/corp-root-ca.pem
bapm install
```

Подходит, когда не хочется менять окружение всего процесса или когда CA нужен только bapm. Требуется Node >=22.15 (в bapm используются `tls.getCACertificates` / `tls.setDefaultCACertificates`). На более старом Node используйте `NODE_EXTRA_CA_CERTS` или обновите Node.

Поведение при ошибках — fail closed:

| Ситуация                         | Результат                                                            |
| -------------------------------- | -------------------------------------------------------------------- |
| Файл не читается                 | ошибка `REGISTRY_TLS` с путём и подсказкой про `NODE_EXTRA_CA_CERTS` |
| В файле нет PEM-сертификата      | ошибка `REGISTRY_TLS`                                                |
| Один из сертификатов повреждён   | ошибка `REGISTRY_TLS` с номером блока                                |
| `BAPM_DISABLE_EXTRA_CA_BUNDLE=1` | bundle игнорируется, даже если путь задан                            |

Отключить bundle для одного запуска:

```bash
BAPM_DISABLE_EXTRA_CA_BUNDLE=1 bapm install
```

## Проверить, что CA подходит

```bash
# Показывает цепочку, которую отдаёт registry
openssl s_client -connect registry.example.com:443 -servername registry.example.com -showcerts </dev/null

# Проверяет цепочку против вашего bundle
openssl verify -CAfile /etc/ssl/certs/corp-root-ca.pem registry-chain.pem
```

В PEM должны быть именно сертификаты CA (корневой и, при необходимости, промежуточные), а не клиентский сертификат и не приватный ключ. Приватный ключ в bundle не нужен.

## Частые причины

- **Registry за proxy, а proxy подменяет TLS.** Нужен CA прокси, а не CA registry.
- **Передан только leaf-сертификат.** Добавьте промежуточный и корневой CA.
- **`NODE_EXTRA_CA_CERTS` задан после старта.** Перезапустите процесс/CI job.
- **Несколько версий Node.** Убедитесь, что `bapm` запускается тем Node, для которого задана переменная (`node -v`).
- **Registry доступен по `http://`.** Это отдельный сценарий: см. `registries.<name>.insecure` и `--allow-insecure` в [install](/reference/install).

## См. также

- [install](/reference/install) — флаги и переменные registry
- [publish](/reference/publish) — публикация в приватный registry
- [Registries и маркетплейс](/guide/manifest-registries)
