# R1-002 Gateway public-key-only repair and current build

- Baseline: `8215c95d8ad63169a68afb997f2d7ad8bc1b9b71`, branch `dev-redesign`.
- Source owner: `services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayIamPublicJwkSource.java` and corresponding `GatewayIamPublicJwkSourceTest.java` only.
- IAM remains the sole token issuer. Gateway owns verification-key selection and bounded public-key caching; this repair adds no API, service/data ownership, token signing, dependency, RS256 or cache-policy change.
- Trace: R1-002 / BC-002, Phase 1 IAM registration prerequisite; registration 201/session/no-learning-capability acceptance remains a separate runtime responsibility. This delivery alone does not accept R1-002, IT-1, or another R1 card.

## Document rejection boundary

The complete parsed JSON document is inspected before Nimbus parses its key set. Presence of any RSA private member `d/p/q/dp/dq/qi/oth`, EC/OKP `d`, or symmetric `k` rejects the whole document, regardless of value type (including null) or unsupported/malformed key type. The scan includes bare key sets, the documented `data` envelope, ignored alternative lists and nested extensions; a public key in a mixed document cannot make the document acceptable. This conservative boundary reserves these member names throughout the JWKS publication document, including extensions. The current standard metadata (`requestId`) remains accepted; arbitrary future metadata using these names would need an explicit contract decision rather than bypassing this check.

After parsing, every Nimbus key must additionally report `isPrivate() == false`. Failures use the fixed message `IAM public JWKS document contains private key material`; parse failures retain neither input nor the original parser exception cause. Rejected documents never enter the successful public-key cache. All generated private RSA material exists only in unit-test memory; no private key document, business JWT, or private parameter value is included in evidence.

## Verification and build

`build-receipt.json` binds the actual locked Java 25 / Maven executables and versions, exact commands and exit codes, sorted source/pom/toolchain/shared-tool input snapshot, before/after equality, test counts and packaged JAR bytes/SHA-256. The 24 exact JWK-source test invocations passed with zero failures, errors or skipped tests. Parameterized cases additionally exercise five value shapes for each of the eight private member names. Existing envelope/public selection, unknown/absent kid, cache reuse/expiry, rotation and bounded read tests remain included.

The package command is `mvn -f services/api-gateway/pom.xml clean package -DskipTests` following the precise test command. It packages current source, does not claim full-suite regression, and does not start a server. `runtime-builds.json` separately records owner-authorized IAM and Learner packaging from unchanged module inputs for the runtime owner.

No Docker restart/down/prune, service startup, port changes, database writes, shared progress edits, Git staging or commits were performed by this source/build owner. The three existing mobile documentation differences remain untouched.
