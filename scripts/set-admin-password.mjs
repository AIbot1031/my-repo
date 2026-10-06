import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js");

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password stays hidden.");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const done = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) return done(new Error("Cancelled."));
        if (byte === 10 || byte === 13) return done();
        if (byte === 8 || byte === 127) value = value.slice(0, -1);
        else if (byte >= 32 && byte <= 126) value += String.fromCharCode(byte);
      }
    };
    process.stdin.on("data", onData);
  });
}

try {
  let first = await readHidden("New admin password (16–128 ASCII characters): ");
  if (!/^[\x20-\x7e]{16,128}$/.test(first)) {
    throw new Error("Use 16–128 printable ASCII characters.");
  }
  const second = await readHidden("Enter it again: ");
  if (first !== second) throw new Error("The passwords did not match.");

  const salt = randomBytes(24).toString("hex");
  const hash = pbkdf2Sync(first, salt, 100_000, 32, "sha256").toString("hex");
  let record = JSON.stringify({ salt, hash, iterations: 100_000 });
  const child = spawn(process.execPath, [wrangler, "secret", "put", "ADMIN_PASSWORD_RECORD"], {
    cwd: projectRoot,
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin.end(record, () => { record = ""; first = ""; });
  child.on("error", () => {
    process.stderr.write("Could not start Wrangler. Run npm install first.\n");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    first = "";
    record = "";
    process.exitCode = code ?? 1;
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Could not set the admin password."}\n`);
  process.exitCode = 1;
}
