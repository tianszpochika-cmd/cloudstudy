import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const servicesPath = path.resolve(rootDir, "config/local-services.json");
const portsPath = path.resolve(rootDir, "config/local-ports.json");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--static-only", "--require-healthy"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));

if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  console.error("Usage: node scripts/check-local-infra.mjs [--static-only] [--require-healthy]");
  process.exit(2);
}

const staticOnly = args.has("--static-only");
const requireHealthy = args.has("--require-healthy");
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
  console.error(`[FAIL] ${message}`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[WARN] ${message}`);
}

function run(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serviceBlock(composeText, serviceName) {
  const lines = composeText.split(/\r?\n/);
  const servicePattern = new RegExp(`^  ${escapeRegExp(serviceName)}:\\s*$`);
  const start = lines.findIndex((line) => servicePattern.test(line));
  if (start < 0) {
    return null;
  }

  const end = lines.slice(start + 1).findIndex((line) => /^  [A-Za-z0-9_-]+:\s*$/.test(line));
  return lines.slice(start, end < 0 ? lines.length : start + 1 + end).join("\n");
}

function hasServiceMarker(composeText, serviceName, marker) {
  const block = serviceBlock(composeText, serviceName);
  return Boolean(block && block.includes(marker));
}

function parseComposePs(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      });
  }
}

const composePath = path.resolve(rootDir, "infra/docker/docker-compose.dev.yml");
const dotEnvPath = path.resolve(rootDir, ".env");
const [servicesConfig, portsConfig, composeText, dotEnvText] = await Promise.all([
  readFile(servicesPath, "utf8").then(JSON.parse),
  readFile(portsPath, "utf8").then(JSON.parse),
  readFile(composePath, "utf8"),
  readFile(dotEnvPath, "utf8").catch(() => "")
]);

function parseDotEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
      .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
  );
}

// Docker Compose gives the process environment precedence over .env. Validate
// both sources so a local override cannot silently move a registered port.
const configuredEnv = { ...parseDotEnv(dotEnvText), ...process.env };

const expectedHost = servicesConfig.host;
if (expectedHost !== "127.0.0.1") {
  fail(`config/local-services.json host must be 127.0.0.1, got ${expectedHost}`);
}
if (servicesConfig.portSource !== "config/local-ports.json") {
  fail(`local service port source must be config/local-ports.json, got ${servicesConfig.portSource}`);
}
if (servicesConfig.policy?.bindOnlyToLoopback !== true) {
  fail("local service policy must require loopback-only binding");
}
if (servicesConfig.policy?.autoIncrement !== false) {
  fail("local service policy must disable automatic port increment");
}

const dependencyNames = Object.keys(servicesConfig.services ?? {});
const requiredDependencies = servicesConfig.requiredDependencies ?? ["mysql", "redis", "minio", "kafka"];
for (const dependencyName of requiredDependencies) {
  if (!servicesConfig.services?.[dependencyName]) {
    fail(`missing dependency definition: ${dependencyName}`);
  }
}

const seenPorts = new Map();
for (const dependencyName of dependencyNames) {
  const definition = servicesConfig.services[dependencyName];
  const composeName = definition.composeService;
  if (!composeName || !serviceBlock(composeText, composeName)) {
    fail(`Compose service is missing: ${composeName || dependencyName}`);
    continue;
  }
  if (!definition.image || !hasServiceMarker(composeText, composeName, `image: ${definition.image}`)) {
    fail(`${composeName} image does not match local service manifest`);
  }
  if (!hasServiceMarker(composeText, composeName, "restart: ")) {
    fail(`${composeName} must define a restart policy`);
  }
  if (!hasServiceMarker(composeText, composeName, "healthcheck:")) {
    fail(`${composeName} must define a healthcheck`);
  }
  if (definition.healthcheckMarker && !hasServiceMarker(composeText, composeName, definition.healthcheckMarker)) {
    fail(`${composeName} healthcheck marker is missing: ${definition.healthcheckMarker}`);
  }
  if (!definition.volume || !composeText.includes(`${definition.volume}:/`)) {
    fail(`${composeName} must use its declared persistent volume: ${definition.volume}`);
  }

  for (const binding of definition.bindings ?? []) {
    const portDefinition = portsConfig.services?.[binding.portKey];
    if (!portDefinition) {
      fail(`${composeName} references unknown port key: ${binding.portKey}`);
      continue;
    }
    if (portDefinition.port !== binding.hostPort) {
      fail(`${binding.portKey} is ${portDefinition.port} in local-ports.json but ${binding.hostPort} in local-services.json`);
    }
    if (portDefinition.protocol !== binding.protocol) {
      fail(`${binding.portKey} protocol mismatch: ${portDefinition.protocol} vs ${binding.protocol}`);
    }
    const previousOwner = seenPorts.get(binding.hostPort);
    if (previousOwner) {
      fail(`duplicate host port ${binding.hostPort}: ${previousOwner} and ${dependencyName}`);
    }
    seenPorts.set(binding.hostPort, `${dependencyName}/${binding.portKey}`);

    const composePortToken = `"${expectedHost}:$\{${binding.hostPortEnv}:-${binding.hostPort}\}:${binding.containerPort}"`;
    if (!hasServiceMarker(composeText, composeName, composePortToken)) {
      fail(`${composeName} is missing fixed loopback mapping: ${composePortToken}`);
    }
    const configuredPort = configuredEnv[binding.hostPortEnv];
    if (configuredPort !== undefined && configuredPort !== "" && String(configuredPort) !== String(binding.hostPort)) {
      fail(`${binding.hostPortEnv}=${configuredPort} would drift from fixed ${binding.hostPort}; do not override registered ports`);
    }
  }
}

const minioInitialization = servicesConfig.minioInitialization;
if (!minioInitialization || !serviceBlock(composeText, minioInitialization.composeService)) {
  fail("MinIO bucket initialization service is missing");
} else {
  if (!hasServiceMarker(composeText, minioInitialization.composeService, "depends_on:")) {
    fail("MinIO bucket initialization must depend on MinIO");
  }
  if (!hasServiceMarker(composeText, minioInitialization.composeService, "mc mb --ignore-existing")) {
    fail("MinIO bucket initialization must be idempotent");
  }
  if (!hasServiceMarker(composeText, minioInitialization.composeService, "mc anonymous set none")) {
    fail("MinIO bucket initialization must keep the local bucket private");
  }
}

if (!composeText.includes("127.0.0.1:")) {
  fail("Compose must bind dependency ports to 127.0.0.1");
}

if (failures.length === 0) {
  pass(`static infrastructure configuration (${requiredDependencies.length} dependencies, ${seenPorts.size} fixed bindings)`);
}

function composeArgs(...extra) {
  const composeFile = path.relative(rootDir, path.resolve(rootDir, servicesConfig.composeFile)).split(path.sep).join("/");
  return ["compose", "-f", composeFile, ...extra];
}

const dockerProbe = staticOnly ? null : run("docker", ["version", "--format", "{{.Server.Version}}"]);
const dockerAvailable = Boolean(dockerProbe && dockerProbe.status === 0);

if (!staticOnly && dockerAvailable && failures.length === 0) {
  const configCheck = run("docker", composeArgs("config", "--quiet"));
  if (configCheck.status === 0) {
    pass("Docker Compose configuration");
  } else {
    fail(`Docker Compose configuration is invalid${configCheck.stderr ? `: ${configCheck.stderr.trim()}` : ""}`);
  }

  console.log("Docker runtime health:");
  const runtimeResults = [];
  for (const dependencyName of requiredDependencies) {
    const composeName = servicesConfig.services[dependencyName].composeService;
    let psResult = run("docker", composeArgs("ps", "--all", "--format", "json", composeName));
    if (psResult.status !== 0) {
      psResult = run("docker", composeArgs("ps", "--format", "json", composeName));
    }
    const records = parseComposePs(psResult.stdout ?? "");
    const record = records.find((item) => item.Service === composeName) ?? records[0];
    if (!record) {
      runtimeResults.push({ dependencyName, status: "not-created", healthy: false });
      console.log(`  - ${dependencyName}: not-created`);
      continue;
    }
    const state = String(record.State ?? "unknown").toLowerCase();
    const health = String(record.Health ?? "").toLowerCase();
    const status = health || state;
    const healthy = health === "healthy";
    runtimeResults.push({ dependencyName, status, healthy });
    console.log(`  - ${dependencyName}: ${status}${state && state !== status ? ` (state=${state})` : ""}`);
  }

  const unhealthy = runtimeResults.filter((item) => !item.healthy);
  if (unhealthy.length > 0) {
    const names = unhealthy.map((item) => item.dependencyName).join(", ");
    if (requireHealthy) {
      fail(`runtime dependencies are not all healthy: ${names}`);
    } else {
      warn(`runtime dependencies are not all healthy: ${names}; use --require-healthy to fail on this condition`);
    }
  }
} else if (!staticOnly && !dockerAvailable) {
  const details = dockerProbe?.error?.message || dockerProbe?.stderr?.trim() || "Docker daemon is unavailable";
  if (requireHealthy) {
    fail(`Docker runtime health was requested but Docker is unavailable: ${details}`);
  } else {
    warn(`Docker is unavailable; static checks completed only: ${details}`);
  }
} else if (staticOnly) {
  console.log("Docker runtime health: skipped (--static-only)");
}

if (warnings.length > 0) {
  console.log(`Completed with ${warnings.length} warning(s).`);
}
if (failures.length > 0) {
  console.error(`Completed with ${failures.length} failure(s).`);
  process.exitCode = 1;
}
