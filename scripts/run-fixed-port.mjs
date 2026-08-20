import net from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(scriptDir, "../config/local-ports.json");
const args = process.argv.slice(2);
const serviceKey = args[0];
const separator = args.indexOf("--");

if (!serviceKey || separator < 0 || separator === args.length - 1) {
  console.error("Usage: node scripts/run-fixed-port.mjs <service-key> -- <command> [args...]");
  process.exit(2);
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const service = registry.services?.[serviceKey];
if (!service) {
  console.error("Unknown local port service: " + serviceKey);
  process.exit(2);
}

const host = registry.host || "127.0.0.1";
const port = service.port;
const command = args[separator + 1];
const commandArgs = args.slice(separator + 2);

function assertPortIsFree() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error("Port " + port + " is already in use for " + serviceKey + ". Stop the owner; do not auto-increment."));
      } else {
        reject(error);
      }
    });
    probe.listen({ host, port }, () => {
      probe.close(() => resolve());
    });
  });
}

try {
  await assertPortIsFree();
} catch (error) {
  console.error("[fixed-port] " + error.message);
  process.exit(3);
}

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    SERVICE_PORT: String(port)
  },
  shell: process.platform === "win32",
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
