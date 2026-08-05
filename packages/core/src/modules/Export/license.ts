/**
 * Offline SPDX declared-license classifier (APM-aligned three-state).
 * Uses a compact built-in id set; unrecognized strings render as named, never rejected.
 */

export const KIND_ID = "id";
export const KIND_EXPRESSION = "expression";
export const KIND_NAMED = "named";

export type LicenseKind = typeof KIND_ID | typeof KIND_EXPRESSION | typeof KIND_NAMED;

export type LicenseClass = {
  kind: LicenseKind;
  value: string;
};

/** Common SPDX license identifiers (case-sensitive as published). */
const SPDX_LICENSE_IDS = new Set<string>([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "ISC",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "MIT",
  "MPL-2.0",
  "Unlicense",
]);

const SPDX_EXCEPTION_IDS = new Set<string>([
  "Classpath-exception-2.0",
  "LLVM-exception",
  "GPL-3.0-linking-exception",
]);

const OPERATORS = new Set(["AND", "OR"]);

function isLicenseRef(token: string): boolean {
  return token.startsWith("LicenseRef-") || token.startsWith("DocumentRef-");
}

function isValidLicenseId(token: string): boolean {
  const bare = token.endsWith("+") ? token.slice(0, -1) : token;
  return Boolean(bare) && (SPDX_LICENSE_IDS.has(bare) || isLicenseRef(token));
}

function tokenize(text: string): string[] {
  return text.replaceAll("(", " ( ").replaceAll(")", " ) ").split(/\s+/).filter(Boolean);
}

function hasExpressionSyntax(tokens: string[]): boolean {
  for (const tok of tokens) {
    if (tok === "(" || tok === ")" || OPERATORS.has(tok.toUpperCase()) || tok.toUpperCase() === "WITH") {
      return true;
    }
  }
  return false;
}

class ExpressionParser {
  private pos = 0;
  constructor(private readonly tokens: string[]) {}

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private advance(): string | undefined {
    const tok = this.peek();
    if (tok !== undefined) this.pos += 1;
    return tok;
  }

  parse(): boolean {
    if (!this.parseOr()) return false;
    return this.pos === this.tokens.length;
  }

  private parseOr(): boolean {
    if (!this.parseUnit()) return false;
    let nxt = this.peek();
    while (nxt !== undefined && OPERATORS.has(nxt.toUpperCase())) {
      this.advance();
      if (!this.parseUnit()) return false;
      nxt = this.peek();
    }
    return true;
  }

  private parseUnit(): boolean {
    const tok = this.peek();
    if (tok === undefined) return false;
    if (tok === "(") {
      this.advance();
      if (!this.parseOr()) return false;
      return this.advance() === ")";
    }
    if (tok === ")" || OPERATORS.has(tok.toUpperCase()) || tok.toUpperCase() === "WITH") {
      return false;
    }
    this.advance();
    if (!isValidLicenseId(tok)) return false;
    const nxt = this.peek();
    if (nxt !== undefined && nxt.toUpperCase() === "WITH") {
      this.advance();
      const exc = this.advance();
      return exc !== undefined && SPDX_EXCEPTION_IDS.has(exc);
    }
    return true;
  }
}

/** Classify a non-empty declared license string for SBOM rendering. */
export function classifyDeclaredLicense(declared: string): LicenseClass {
  const value = declared.trim();
  if (!value) return { kind: KIND_NAMED, value };

  if (value.toUpperCase() === "UNLICENSED" || value.toUpperCase().startsWith("SEE LICENSE IN ")) {
    return { kind: KIND_NAMED, value };
  }

  const tokens = tokenize(value);
  if (!hasExpressionSyntax(tokens)) {
    if (tokens.length === 1 && isValidLicenseId(tokens[0]!)) {
      return { kind: KIND_ID, value };
    }
    return { kind: KIND_NAMED, value };
  }

  if (new ExpressionParser(tokens).parse()) {
    return { kind: KIND_EXPRESSION, value };
  }
  return { kind: KIND_NAMED, value };
}
