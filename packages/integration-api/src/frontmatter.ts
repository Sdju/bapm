/**
 * Shared YAML frontmatter parsing for markdown-derived host files.
 *
 * The parser preserves field lines so hosts can re-emit kept fields without
 * losing formatting, while `frontmatterList` normalizes the common list forms.
 */

export type FrontmatterField = {
  key: string;
  /** Trimmed inline value after `key:` (empty for block values). */
  value: string;
  /** Key line plus continuation lines, in source order. */
  lines: string[];
};

export type ParsedFrontmatter = {
  fields: FrontmatterField[];
  /** Non-empty non-key lines before the first field (comments, notes). */
  prelude: string[];
  body: string;
  hasFrontmatter: boolean;
};

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Parse a leading YAML frontmatter block. Missing fences return the full source as body. */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) {
    return { fields: [], prelude: [], body: source, hasFrontmatter: false };
  }

  const lines = (match[1] ?? "").split(/\r?\n/);
  const body = match[2] ?? "";
  const fields: FrontmatterField[] = [];
  const prelude: string[] = [];
  let current: FrontmatterField | undefined;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:(.*)$/);
    if (!keyMatch) {
      if (current) current.lines.push(line);
      else if (line.trim()) prelude.push(line);
      index += 1;
      continue;
    }

    current = { key: keyMatch[1]!, value: (keyMatch[2] ?? "").trim(), lines: [line] };
    fields.push(current);
    index += 1;

    // Consume indented continuation, list items, and block-scalar text.
    while (index < lines.length) {
      const next = lines[index]!;
      if (/^[A-Za-z0-9_-]+\s*:/.test(next)) break;
      if (!next.trim()) {
        index += 1;
        break;
      }
      if (/^[ \t]/.test(next) || /^[ \t]*-/.test(next)) {
        current.lines.push(next);
        index += 1;
        continue;
      }
      break;
    }
  }

  return { fields, prelude, body, hasFrontmatter: true };
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Normalize a frontmatter field to a string list.
 * Supports inline `[a, b]`, scalar values, and block `- item` lists.
 */
export function frontmatterList(
  field: FrontmatterField | undefined,
  options: { splitScalarCommas?: boolean } = {},
): string[] {
  if (!field) return [];
  const inline = field.value.trim();
  if (inline.startsWith("[") && inline.endsWith("]")) {
    return inline
      .slice(1, -1)
      .split(",")
      .map((part) => unquote(part.trim()))
      .filter(Boolean);
  }
  if (inline && inline !== "|" && inline !== ">") {
    const parts = options.splitScalarCommas ? inline.split(",") : [inline];
    return parts.map((part) => unquote(part.trim())).filter(Boolean);
  }

  const values: string[] = [];
  for (const line of field.lines.slice(1)) {
    const listMatch = line.match(/^[ \t]*-[ \t]*(.+)$/);
    if (listMatch) values.push(unquote(listMatch[1]!.trim()));
  }
  return values.filter(Boolean);
}

/**
 * Render a frontmatter block from prepared lines and preserve body text.
 * `lines` empty ⇒ no fences, matching host transforms that drop all keys.
 */
export function renderFrontmatter(lines: readonly string[], body: string): string {
  const normalizedBody = body.replace(/\s+$/, "\n") || body;
  if (lines.length === 0) return normalizedBody;
  return `---\n${lines.join("\n")}\n---\n${body}`.replace(/\s+$/, "\n");
}
