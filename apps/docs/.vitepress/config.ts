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
      { text: "Агенты", link: "/guide/supported-hosts" },
      { text: "Манифест", link: "/guide/config-manifest" },
      { text: "Справка", link: "/reference/" },
      { text: "Сценарии", link: "/guide/situations/" },
      { text: "Архитектура", link: "/architecture/" },
    ],
    sidebar: [
      {
        text: "Руководство",
        items: [
          { text: "Что умеет bapm", link: "/guide/" },
          { text: "Быстрый старт", link: "/guide/quick-start" },
          { text: "Команды", link: "/guide/commands" },
          { text: "Поддерживаемые hosts", link: "/guide/supported-hosts" },
        ],
      },
      {
        text: "Конфиг",
        items: [
          { text: "Манифест bapm.yml", link: "/guide/config-manifest" },
          { text: "Зависимости", link: "/guide/manifest-dependencies" },
          { text: "Hosts и target", link: "/guide/manifest-hosts" },
          { text: "Personal overlay", link: "/guide/manifest-overlay" },
          { text: "Registries", link: "/guide/manifest-registries" },
          { text: "Lock-файл", link: "/guide/lockfile" },
        ],
      },
      {
        text: "Сценарии",
        items: [
          { text: "Оглавление", link: "/guide/situations/" },
          { text: "Свежий install", link: "/guide/situations/install-fresh" },
          { text: "CI / frozen", link: "/guide/situations/ci-frozen" },
          { text: "Обновление зависимостей", link: "/guide/situations/update-deps" },
          { text: "Политика и MCP", link: "/guide/situations/policy-mcp" },
          { text: "Compile AGENTS.md", link: "/guide/situations/compile-agents" },
          { text: "Doctor / audit / prune", link: "/guide/situations/doctor-audit-prune" },
          { text: "Marketplace pack", link: "/guide/situations/marketplace-pack" },
        ],
      },
      {
        text: "Справка",
        items: [
          { text: "Оглавление", link: "/reference/" },
          { text: "init", link: "/reference/init" },
          { text: "install", link: "/reference/install" },
          { text: "lock", link: "/reference/lock" },
          { text: "update", link: "/reference/update" },
          { text: "outdated", link: "/reference/outdated" },
          { text: "uninstall", link: "/reference/uninstall" },
          { text: "prune", link: "/reference/prune" },
          { text: "deps", link: "/reference/deps" },
          { text: "find", link: "/reference/find" },
          { text: "view", link: "/reference/view" },
          { text: "audit", link: "/reference/audit" },
          { text: "doctor", link: "/reference/doctor" },
          { text: "compile", link: "/reference/compile" },
          { text: "policy / approve / deny", link: "/reference/policy" },
          { text: "cache", link: "/reference/cache" },
          { text: "self-update", link: "/reference/self-update" },
          { text: "pack", link: "/reference/pack" },
          { text: "plugin", link: "/reference/plugin" },
          { text: "marketplace", link: "/reference/marketplace" },
          { text: "search", link: "/reference/search" },
          { text: "publish", link: "/reference/publish" },
        ],
      },
      {
        text: "Совместимость",
        items: [
          { text: "Совместимость и OpenAPM", link: "/guide/conformance" },
          { text: "Portable Agent Plugins", link: "/guide/agent-plugins" },
        ],
      },
      {
        text: "Архитектура",
        items: [{ text: "Обзор для контрибьюторов", link: "/architecture/" }],
      },
    ],
  },
});
