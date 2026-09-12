// Provisions the local Kafka topics from config/b26-event-runtime.json.
//
// The event runtime contract sets adminClientInApplication: false, so topics are an operator
// responsibility rather than something a service creates at boot. Six of the twelve declared topics
// existed on the local broker and six did not, which means the existing set was made by hand.
// This script makes the topology reproducible from the contract and reports drift instead of
// silently mutating a live topic: partition count can never be reduced, so an existing topic is
// verified and reported, never rewritten.
//
//   node scripts/runtime/provision-kafka-topics.mjs            plan only (default)
//   node scripts/runtime/provision-kafka-topics.mjs --apply    create what is missing
//
// It only ever talks to the registered loopback broker from config/local-ports.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const contract = readJson('config/b26-event-runtime.json');
const localPorts = readJson('config/local-ports.json');

const apply = process.argv.includes('--apply');
const unknown = process.argv.slice(2).filter((arg) => arg !== '--apply');
if (unknown.length > 0) {
  console.error(`unsupported argument(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const container = process.env.KAFKA_CONTAINER ?? 'yuxuexing-local-kafka-1';
const broker = `localhost:${localPorts.infrastructure?.kafka?.port ?? 19092}`;
const kafkaBin = process.env.KAFKA_BIN ?? '/opt/kafka/bin';

function kafka(args) {
  const result = spawnSync('docker', ['exec', container, 'sh', '-c',
    `${kafkaBin}/kafka-topics.sh --bootstrap-server ${broker} ${args}`,
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').replace(/\r/g, '').trim(),
    stderr: (result.stderr ?? '').replace(/\r/g, '').trim(),
  };
}

// The local broker is a single node, so the local override is mandatory for every topic. Refusing
// to guess keeps a topic from being created with a replication factor it cannot satisfy.
const localSpec = (topic) => {
  const override = topic.localRuntimeOverride;
  if (!override || override.replicationFactor !== 1 || override.minInSyncReplicas !== 1) {
    throw new Error(`${topic.name} has no single-node localRuntimeOverride; refusing to guess`);
  }
  return {
    partitions: topic.partitions,
    replicationFactor: override.replicationFactor,
    minInSyncReplicas: override.minInSyncReplicas,
    retentionMs: topic.retentionMs,
    cleanupPolicy: topic.cleanupPolicy,
  };
};

function kafkaConfigs(args) {
  const result = spawnSync('docker', ['exec', container, 'sh', '-c',
    `${kafkaBin}/kafka-configs.sh --bootstrap-server ${broker} ${args}`,
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').replace(/\r/g, '').trim(),
    stderr: (result.stderr ?? '').replace(/\r/g, '').trim(),
  };
}

function describe(name) {
  const result = kafka(`--describe --topic ${name}`);
  if (!result.ok) return null;
  const line = result.stdout.split('\n').find((row) => row.startsWith('Topic:'));
  if (!line) return null;
  const partitions = Number(/PartitionCount:\s*(\d+)/u.exec(line)?.[1]);
  const replication = Number(/ReplicationFactor:\s*(\d+)/u.exec(line)?.[1]);
  const configs = Object.fromEntries((/Configs:\s*(.*)$/u.exec(line)?.[1] ?? '')
    .split(',').filter(Boolean).map((pair) => pair.split('=').map((part) => part.trim())));
  return { partitions, replication, configs };
}

const created = [];
const repaired = [];
const conforming = [];
const drifted = [];
const errors = [];

for (const topic of contract.topics) {
  let spec;
  try {
    spec = localSpec(topic);
  } catch (error) {
    errors.push(error.message);
    continue;
  }

  const observed = describe(topic.name);
  const desired = {
    partitions: spec.partitions,
    replication: spec.replicationFactor,
    'retention.ms': String(spec.retentionMs),
    'cleanup.policy': spec.cleanupPolicy,
    'min.insync.replicas': String(spec.minInSyncReplicas),
  };

  if (!observed) {
    if (!apply) {
      created.push({ topic: topic.name, action: 'would-create', desired });
      continue;
    }
    const result = kafka(`--create --topic ${topic.name} --partitions ${spec.partitions} `
      + `--replication-factor ${spec.replicationFactor} `
      + `--config retention.ms=${spec.retentionMs} --config cleanup.policy=${spec.cleanupPolicy} `
      + `--config min.insync.replicas=${spec.minInSyncReplicas}`);
    if (!result.ok) {
      errors.push(`${topic.name}: create failed: ${result.stderr.split('\n')[0]}`);
      continue;
    }
    const readBack = describe(topic.name);
    if (!readBack) {
      errors.push(`${topic.name}: created but could not be described`);
      continue;
    }
    created.push({ topic: topic.name, action: 'created', desired, observed: readBack });
    continue;
  }

  const mismatches = Object.entries(desired).filter(([key, value]) => {
    if (key === 'partitions') return observed.partitions !== spec.partitions;
    if (key === 'replication') return observed.replication !== spec.replicationFactor;
    return observed.configs[key] !== value;
  }).map(([key, value]) => ({ key, desired: value, observed: key === 'partitions' ? observed.partitions : key === 'replication' ? observed.replication : observed.configs[key] }));

  if (mismatches.length === 0) {
    conforming.push({ topic: topic.name, observed });
    continue;
  }

  // Partition count can be raised but never lowered, so a declared count below the live one is a
  // contract error rather than something to repair.
  if (observed.partitions > spec.partitions) {
    errors.push(`${topic.name}: live partition count ${observed.partitions} exceeds the declared ${spec.partitions}; partitions cannot be reduced`);
    drifted.push({ topic: topic.name, mismatches });
    continue;
  }
  if (!apply) {
    drifted.push({ topic: topic.name, mismatches, action: 'would-repair' });
    continue;
  }

  const repairs = [];
  if (observed.partitions < spec.partitions) {
    const result = kafka(`--alter --topic ${topic.name} --partitions ${spec.partitions}`);
    if (!result.ok) {
      errors.push(`${topic.name}: partition increase failed: ${result.stderr.split('\n')[0]}`);
      continue;
    }
    repairs.push(`partitions ${observed.partitions} -> ${spec.partitions}`);
  }
  const configDiff = mismatches.filter((mismatch) => mismatch.key !== 'partitions' && mismatch.key !== 'replication');
  if (configDiff.length > 0) {
    const addConfig = configDiff.map((mismatch) => `${mismatch.key}=${mismatch.desired}`).join(',');
    const result = kafkaConfigs(`--alter --entity-type topics --entity-name ${topic.name} --add-config ${addConfig}`);
    if (!result.ok) {
      errors.push(`${topic.name}: config repair failed: ${result.stderr.split('\n')[0]}`);
      continue;
    }
    repairs.push(...configDiff.map((mismatch) => `${mismatch.key} ${mismatch.observed ?? '(unset)'} -> ${mismatch.desired}`));
  }

  const readBack = describe(topic.name);
  const remaining = Object.entries(desired).filter(([key, value]) => {
    if (key === 'partitions') return readBack.partitions !== spec.partitions;
    if (key === 'replication') return readBack.replication !== spec.replicationFactor;
    return readBack.configs[key] !== value;
  });
  if (remaining.length > 0) {
    errors.push(`${topic.name}: still non-conforming after repair: ${remaining.map(([key]) => key).join(', ')}`);
    drifted.push({ topic: topic.name, mismatches, repairs });
    continue;
  }
  repaired.push({ topic: topic.name, repairs, observed: readBack });
}

const evidence = {
  schema: 'platform.kafka.topic-topology.evidence.v1',
  taskId: 'P1R-M2-005',
  mode: apply ? 'apply' : 'plan',
  result: errors.length === 0 && drifted.length === 0 ? (apply ? 'PASS' : 'PLAN') : 'FAIL',
  broker: `127.0.0.1:${localPorts.infrastructure?.kafka?.port ?? 19092}`,
  container,
  declaredTopics: contract.topics.length,
  conforming: conforming.length,
  created: created.length,
  repaired: repaired.length,
  drifted: drifted.length,
  checks: { created, repaired, conforming: conforming.map((entry) => entry.topic), drifted, errors },
  sensitiveMaterial: { persisted: false, emitted: false },
};

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
process.exitCode = errors.length === 0 && drifted.length === 0 ? 0 : 1;
