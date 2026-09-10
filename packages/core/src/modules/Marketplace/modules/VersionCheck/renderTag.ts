/** Expand `{name}` and `{version}` placeholders (APM `render_tag` parity). */
export function renderTag(pattern: string, name: string, version: string): string {
  return pattern.replaceAll("{version}", version).replaceAll("{name}", name);
}
