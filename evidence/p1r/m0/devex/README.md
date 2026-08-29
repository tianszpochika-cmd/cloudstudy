# P1R M0 DevEx evidence

Scope: `P1R-M0-003`, `P1R-M0-005`, `P1R-M0-006` only.

Decision: **BLOCKED**. This directory records executable evidence and does not mark any P1R ledger item as accepted.

## Verified

- Static toolchain, service version and fixed-port governance: PASS.
- `dev` / `master` CI policy, Windows/Linux jobs and non-placeholder gates: PASS.
- Cross-platform Node test discovery: PASS on root B2 and mobile B10 suites.
- Frozen `pnpm-lock.yaml` install: PASS with pnpm 10.19.0.
- Frontend typecheck and production build: PASS.
- Node and Maven CycloneDX inventories: generated (1,097 locked Node components; 183 resolved Maven components).
- Node and Maven license inventories: PASS; no denied or unknown licenses in the resolved inventory.

## Blocking findings

- The registry-backed dependency audit now reports 1 high-severity finding (0 critical): mobile Vite 5.4.21 remains below the patched Vite 6.4.3 release because the current `@dcloudio/vite-plugin-uni` declares an exact Vite 5.2.8 peer dependency. The supply-chain gate correctly exits non-zero; no exception was added.

## Local Java note

The default system PATH is not used as acceptance evidence. With task-local `JAVA_HOME=C:\\Program Files\\Java\\jdk-25`, the runtime diagnostic detects Java 25.0.1 and Maven 3.9.12 and passes. The user machine was not changed globally; another workstation must select its own installed Java 25 path and rerun the diagnostic.

## Evidence files

- `devex-verification.json`: task-by-task commands, results and blockers.
- `dependency-governance.json`: version catalog checks, manifest hashes and vulnerability summary.
- `license-audit.json`: resolved Node/Maven license inventory.
- `sbom-node.cdx.json`: lock-derived Node CycloneDX SBOM.
- `sbom-maven.cdx.json`: Maven-resolved CycloneDX SBOM.
- `maven-direct-inventory.cdx.json`: direct service dependency inventory.
- `node-high-vulnerability-remediation.json`: before/after high-severity remediation, remaining advisory, compatibility risk and handoff steps.

Regenerate with:

```text
pnpm p1r:toolchain:static
node scripts/audit/p1r-dependency-audit.mjs --runtime --emit evidence/p1r/m0/devex
pnpm p1r:devex:evidence
```
