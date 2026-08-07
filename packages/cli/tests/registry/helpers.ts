/**
 * CLI registry / publish / self-update test helpers.
 */
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-m10-cli-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export async function withCapturedIo<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (msg?: unknown) => {
    stdout.push(String(msg));
  };
  console.error = (msg?: unknown) => {
    stderr.push(String(msg));
  };
  try {
    const result = await fn();
    return { result, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

export async function runInProject(
  cwd: string,
  argv: string[],
  env?: Record<string, string | undefined>,
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const saved: Record<string, string | undefined> = {};
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  try {
    const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
    return {
      result,
      stdout,
      stderr,
      combined: [...stdout, ...stderr].join("\n"),
    };
  } finally {
    if (env) {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }
}

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function sha256Digest(content: Uint8Array | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

/** Minimal store-only ZIP (no fflate dep in CLI package). */
export function buildFlatPackageZip(options?: { name?: string; version?: string }): Uint8Array {
  const name = options?.name ?? "contoso/demo";
  const version = options?.version ?? "1.0.0";
  const enc = new TextEncoder();
  return createStoreZip({
    "apm.yml": enc.encode(
      `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`,
    ),
    ".apm/keep.txt": enc.encode("ok\n"),
  });
}

function createStoreZip(files: Record<string, Uint8Array>): Uint8Array {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14); // crc skipped for fixture
    local.writeUInt32LE(data.byteLength, 18);
    local.writeUInt32LE(data.byteLength, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    parts.push(local, Buffer.from(data));

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(0, 16);
    cen.writeUInt32LE(data.byteLength, 20);
    cen.writeUInt32LE(data.byteLength, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
    offset += local.length + data.byteLength;
  }
  const centralDir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...parts, centralDir, end]));
}

export type RecordedPut = {
  url: string;
  authorization: string | undefined;
  body: Buffer;
  contentType: string | undefined;
};

export type MockPublishRegistry = {
  baseUrl: string;
  puts: RecordedPut[];
  setPutStatus: (status: number) => void;
  close: () => Promise<void>;
};

export async function startMockPublishRegistry(options?: {
  putStatus?: number;
}): Promise<MockPublishRegistry> {
  let putStatus = options?.putStatus ?? 201;
  const puts: RecordedPut[] = [];

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    const url = req.url ?? "/";
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "PUT" && /\/v1\/packages\/[^/]+\/[^/]+\/versions\//.test(url)) {
      puts.push({
        url,
        authorization: req.headers.authorization,
        body,
        contentType: req.headers["content-type"],
      });
      res.writeHead(putStatus, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          putStatus === 409
            ? { error: "version already exists" }
            : putStatus >= 400
              ? { error: "failed" }
              : { ok: true },
        ),
      );
      return;
    }

    // Minimal list for resolve-ish probes
    if (method === "GET" && /\/versions\/?$/.test(url)) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ versions: [] }));
      return;
    }

    res.writeHead(404);
    res.end("{}");
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected TCP address");

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    puts,
    setPutStatus: (s) => {
      putStatus = s;
    },
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      }),
  };
}

/** npm-registry-shaped metadata mock for self-update --check. */
export type MockNpmMeta = {
  baseUrl: string;
  close: () => Promise<void>;
};

export async function startMockNpmMetadata(options: {
  packageName?: string;
  latest: string;
}): Promise<MockNpmMeta> {
  const packageName = options.packageName ?? "@bapm/cli";
  const server: Server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === `/${packageName}` || url === `/${packageName}/`) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          name: packageName,
          "dist-tags": { latest: options.latest },
          versions: {
            [options.latest]: { version: options.latest },
          },
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected TCP address");

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      }),
  };
}

export function writePublishProject(
  cwd: string,
  options?: { name?: string; version?: string; filename?: "bapm.yml" | "apm.yml" },
): void {
  const name = options?.name ?? "contoso/demo";
  const version = options?.version ?? "1.0.0";
  const filename = options?.filename ?? "bapm.yml";
  writeText(
    cwd,
    filename,
    `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`,
  );
  writeText(cwd, ".apm/keep.txt", "publish-me\n");
}

export { runCli };
