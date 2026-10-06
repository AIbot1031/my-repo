import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js");

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited with code ${code ?? 1}`)));
  });
}

try {
  await run(process.execPath, ["scripts/run-framework.mjs", "build"], {
    ...process.env,
    DRINK_RECOMMENDER_CLOUDFLARE_ACCOUNT: "1",
  });
  await run(process.execPath, [wrangler, "deploy"]);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Cloudflare deployment failed."}\n`);
  process.exitCode = 1;
}
