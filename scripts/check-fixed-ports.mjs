import net from "node:net";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(scriptDir, "../config/local-ports.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const host = registry.host || "127.0.0.1";
const services = Object.entries(registry.services || {});
const registryOnly = process.argv.includes('--registry-only');
const serviceFlagIndex = process.argv.indexOf('--service');
const selectedService = serviceFlagIndex >= 0 ? process.argv[serviceFlagIndex + 1] : null;

if (serviceFlagIndex >= 0 && (!selectedService || selectedService.startsWith('--'))) {
  console.error('用法: node scripts/check-fixed-ports.mjs [--registry-only] [--service <service-key>]');
  process.exit(2);
}

const duplicatePorts = new Map();
for (const [name, service] of services) {
  const owner = duplicatePorts.get(service.port) || [];
  owner.push(name);
  duplicatePorts.set(service.port, owner);
}
const duplicatePortErrors = [...duplicatePorts.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([port, names]) => `${port}: ${names.join(', ')}`);
if (duplicatePortErrors.length > 0) {
  console.error(`固定端口登记重复: ${duplicatePortErrors.join('; ')}`);
  process.exit(2);
}

if (registryOnly) {
  const invalid = services.filter(([name, service]) => !name || !Number.isInteger(service.port) || service.port < 1 || service.port > 65535);
  for (const [name, service] of services) console.log(`REGISTERED ${service.port} ${name}`);
  if (invalid.length > 0) {
    console.error(`固定端口登记无效: ${invalid.map(([name]) => name).join(', ')}`);
    process.exit(2);
  }
  process.exit(0);
}

const servicesToCheck = selectedService ? services.filter(([name]) => name === selectedService) : services;
if (selectedService && servicesToCheck.length === 0) {
  console.error(`固定端口未登记: ${selectedService}`);
  process.exit(2);
}

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
  servicesToCheck.map(async ([name, service]) => ({ name, port: service.port, free: await isFree(service.port) }))
);
const busy = results.filter((result) => !result.free);

for (const result of results) {
  console.log((result.free ? "FREE " : "BUSY ") + result.port + " " + result.name);
}

if (busy.length > 0) {
  console.error("\n" + busy.length + " fixed project port(s) are busy. Stop the owning process; do not choose another port or auto-increment.");
  process.exit(3);
}
