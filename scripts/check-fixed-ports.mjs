import net from "node:net";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(scriptDir, "../config/local-ports.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const host = registry.host || "127.0.0.1";
const services = Object.entries(registry.services || {});

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen({ host, port }, () => {
      probe.close(() => resolve(true));
    });
  });
}

const results = await Promise.all(
  services.map(async ([name, service]) => ({ name, port: service.port, free: await isFree(service.port) }))
);
const busy = results.filter((result) => !result.free);

for (const result of results) {
  console.log((result.free ? "FREE " : "BUSY ") + result.port + " " + result.name);
}

if (busy.length > 0) {
  console.error("\n" + busy.length + " fixed project port(s) are busy. Stop the owning process; do not choose another port.");
  process.exit(3);
}
