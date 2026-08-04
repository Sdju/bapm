import { defineConfig } from "vitepress";

export default defineConfig({
  title: "bapm",
  description: "Better Agent Package Manager — TypeScript APM with a clean architecture",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Architecture", link: "/architecture/" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Introduction", link: "/guide/" },
          { text: "Quick Start", link: "/guide/quick-start" },
        ],
      },
      {
        text: "Architecture",
        items: [{ text: "Overview", link: "/architecture/" }],
      },
    ],
  },
});
