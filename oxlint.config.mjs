import { fileURLToPath } from "node:url";
import { configFromProject } from "@o-feod/oxlint-structure-plugin/configs";

export default configFromProject({
  rootDir: fileURLToPath(new URL(".", import.meta.url)),
  preset: "recommended",
});
