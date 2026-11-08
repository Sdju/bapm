/**
 * Parse `git ls-remote --tags <repo>` output (no `--refs`).
 *
 * Annotated/signed tags emit two lines: the tag object and its peeled
 * `refs/tags/X^{}` commit. Git consumers (and APM marketplace `source.sha`)
 * pin the peeled commit, so the peeled SHA wins. Lightweight tags have no
 * peel line and keep their direct commit SHA.
 */
export function parseLsRemoteTagsWithPeel(output: string): Array<{
  tag: string;
  commit: string;
  annotated: boolean;
}> {
  const tags = new Map<string, string>();
  const annotated = new Set<string>();

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([0-9a-f]{40})\s+refs\/tags\/(.+)$/i);
    if (!m) continue;
    const sha = m[1]!.toLowerCase();
    let name = m[2]!;
    if (name.endsWith("^{}")) {
      name = name.slice(0, -3);
      tags.set(name, sha);
      annotated.add(name);
    } else if (!tags.has(name)) {
      tags.set(name, sha);
    }
  }

  return [...tags.entries()].map(([tag, commit]) => ({
    tag,
    commit,
    annotated: annotated.has(tag),
  }));
}
