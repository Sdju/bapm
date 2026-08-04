#!/usr/bin/env node
import { runCli } from "./app/run.ts";

const code = await runCli(process.argv.slice(2));
process.exitCode = code;
