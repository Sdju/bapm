import { defineConfig } from "vitepress";

/** Project Pages: set DOCS_BASE=/<repo>/ in CI. Local/preview defaults to "/". */
const base = process.env.DOCS_BASE || "/";

export default defineConfig({
  title: "bapm",
  description: "Better Agent Package Manager — менеджер зависимостей для конфигурации AI-агентов",
  base,
  // Корневые CONFORMANCE.md / AGENT_PLUGINS_COMPATIBILITY.md живут вне apps/docs.
  ignoreDeadLinks: [/CONFORMANCE/, /AGENT_PLUGINS_COMPATIBILITY/],
  themeConfig: {
    nav: [
      { text: "Руководство", link: "/guide/" },
      { text: "Быстрый старт", link: "/guide/quick-start" },
      { text: "Сценарии", link: "/guide/situations/" },
      { text: "Справка", link: "/reference/" },
      { text: "Архитектура", link: "/architecture/" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/Sdju/bapm" }],
    search: {
      provider: "local",
      options: {
        translations: {
          button: {
            buttonText: "Поиск",
            buttonAriaLabel: "Поиск по документации",
          },
          modal: {
            displayDetails: "Показать подробности",
            resetButtonTitle: "Сбросить поиск",
            backButtonTitle: "Назад",
            noResultsText: "Ничего не найдено",
            footer: {
              selectText: "Выбрать",
              selectKeyAriaLabel: "Enter",
              navigateText: "Перейти",
              navigateUpKeyAriaLabel: "Стрелка вверх",
              navigateDownKeyAriaLabel: "Стрелка вниз",
              closeText: "Закрыть",
              closeKeyAriaLabel: "Escape",
            },
          },
        },
      },
    },
    editLink: {
      pattern: "https://github.com/Sdju/bapm/edit/master/apps/docs/:path",
      text: "Редактировать на GitHub",
    },
    sidebar: [
      {
        text: "Руководство",
        items: [
          { text: "Как работает bapm", link: "/guide/" },
          { text: "Быстрый старт", link: "/guide/quick-start" },
          { text: "Команды", link: "/guide/commands" },
          { text: "Выбор агента", link: "/guide/host-selection" },
          { text: "Поддерживаемые агенты", link: "/guide/supported-hosts" },
        ],
      },
      {
        text: "Конфигурация",
        items: [
          { text: "Манифест bapm.yml", link: "/guide/config-manifest" },
          { text: "Зависимости", link: "/guide/manifest-dependencies" },
          { text: "Агенты в манифесте", link: "/guide/manifest-hosts" },
          { text: "Личные настройки", link: "/guide/manifest-overlay" },
          { text: "Registries и маркетплейс", link: "/guide/manifest-registries" },
          { text: "Lock-файл", link: "/guide/lockfile" },
        ],
      },
      {
        text: "Сценарии",
        items: [
          { text: "Все сценарии", link: "/guide/situations/" },
          { text: "Подключить bapm к проекту", link: "/guide/situations/install-fresh" },
          { text: "Команда с разными агентами", link: "/guide/situations/team-local-active" },
          { text: "Личные пакеты", link: "/guide/situations/personal-local-lock" },
          { text: "CI по lock-файлу", link: "/guide/situations/ci-frozen" },
          { text: "Private registry и TLS", link: "/guide/situations/tls-private-registry" },
          { text: "Обновить зависимости", link: "/guide/situations/update-deps" },
          { text: "MCP-сервер не появился", link: "/guide/situations/policy-mcp" },
          { text: "Собрать AGENTS.md", link: "/guide/situations/compile-agents" },
          { text: "Что-то сломалось", link: "/guide/situations/doctor-audit-prune" },
          { text: "Сборка маркетплейса", link: "/guide/situations/marketplace-pack" },
        ],
      },
      {
        text: "Зависимости",
        items: [
          { text: "init", link: "/reference/init" },
          { text: "install", link: "/reference/install" },
          { text: "lock", link: "/reference/lock" },
          { text: "update", link: "/reference/update" },
          { text: "outdated", link: "/reference/outdated" },
          { text: "uninstall", link: "/reference/uninstall" },
          { text: "prune", link: "/reference/prune" },
        ],
      },
      {
        text: "Проверка и восстановление",
        items: [
          { text: "deps", link: "/reference/deps" },
          { text: "find", link: "/reference/find" },
          { text: "view", link: "/reference/view" },
          { text: "audit", link: "/reference/audit" },
          { text: "doctor", link: "/reference/doctor" },
          { text: "cache", link: "/reference/cache" },
          { text: "targets", link: "/reference/targets" },
          { text: "mcp", link: "/reference/mcp" },
          { text: "config", link: "/reference/config" },
          { text: "auth", link: "/reference/auth" },
        ],
      },
      {
        text: "Агент и политика",
        items: [
          { text: "compile", link: "/reference/compile" },
          { text: "policy / approve / deny", link: "/reference/policy" },
        ],
      },
      {
        text: "Публикация и служебные",
        items: [
          { text: "pack", link: "/reference/pack" },
          { text: "plugin", link: "/reference/plugin" },
          { text: "marketplace", link: "/reference/marketplace" },
          { text: "search", link: "/reference/search" },
          { text: "publish", link: "/reference/publish" },
          { text: "self-update", link: "/reference/self-update" },
        ],
      },
      {
        text: "Совместимость",
        items: [
          { text: "APM и OpenAPM", link: "/guide/conformance" },
          { text: "Agent Plugins", link: "/guide/agent-plugins" },
        ],
      },
      {
        text: "Для контрибьюторов",
        items: [{ text: "Архитектура", link: "/architecture/" }],
      },
    ],
  },
});
