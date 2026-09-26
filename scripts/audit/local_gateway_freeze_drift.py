"""Read-only comparison of the current Gateway contract with committed HEAD."""

from __future__ import annotations

import json
import subprocess
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FRAGMENT = "packages/contracts/fragments/p1r-gateway-boundary.openapi.json"
CANONICAL = "packages/contracts/openapi/v1/openapi.json"
OUTPUT = ROOT / "artifacts/audit-2026-09-23/offline-package-fixtures/gateway-freeze-drift.json"
VERBS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


def from_ref(ref, path):
    return json.loads(subprocess.check_output(["git", "show", f"{ref}:{path}"], cwd=ROOT))


def current(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def public_operations(document):
    return {(path, method.upper()) for path, item in document.get("paths", {}).items()
            for method, operation in item.items() if path.startswith("/api/v1/")
            and method.lower() in VERBS and isinstance(operation, dict)}


def executions(document):
    result = {}
    for plan in document["x-p1r-gateway-boundary"]["routeExecutions"]:
        for projection in plan.get("projections", []):
            for method in projection.get("methods", []):
                key = (plan["ruleId"], projection["projectionId"], method)
                result[key] = {
                    "path": projection["publicPathTemplate"],
                    "status": projection["status"],
                    "owner": projection.get("upstreamOwner"),
                    "controller": projection.get("controllerEvidence", {}).get("sourcePath"),
                    "target": projection.get("targetPathTemplate"),
                }
    return result


def grouped(operations):
    groups = defaultdict(list)
    for (rule, projection, method), info in sorted(operations.items()):
        groups[rule].append({"projection": projection, "method": method, **info})
    return dict(groups)


def main():
    candidates = subprocess.check_output(["git", "log", "--format=%H", "--", FRAGMENT],
                                         cwd=ROOT, text=True).splitlines()
    frozen_ref = None
    for ref in candidates:
        candidate = from_ref(ref, FRAGMENT)["x-p1r-gateway-boundary"]
        available = sum(projection.get("status") == "AVAILABLE" for plan in candidate["routeExecutions"]
                        for projection in plan.get("projections", []) for _ in projection.get("methods", []))
        if len(candidate["routeRules"]) == 56 and len(candidate["routeExecutions"]) == 56 and available == 170:
            frozen_ref = ref
            break
    if not frozen_ref:
        raise RuntimeError("no committed Gateway fragment matches the frozen 56/170 baseline")
    old, new = from_ref(frozen_ref, FRAGMENT), current(FRAGMENT)
    old_routes = {rule["ruleId"]: rule for rule in old["x-p1r-gateway-boundary"]["routeRules"]}
    new_routes = {rule["ruleId"]: rule for rule in new["x-p1r-gateway-boundary"]["routeRules"]}
    old_exec, new_exec = executions(old), executions(new)
    added_available = {key: info for key, info in new_exec.items()
                       if info["status"] == "AVAILABLE" and
                       (key not in old_exec or old_exec[key]["status"] != "AVAILABLE")}
    removed_available = {key: info for key, info in old_exec.items()
                         if info["status"] == "AVAILABLE" and
                         (key not in new_exec or new_exec[key]["status"] != "AVAILABLE")}
    old_paths, new_paths = public_operations(from_ref(frozen_ref, CANONICAL)), public_operations(current(CANONICAL))
    output = {
        "source": "frozen committed 56/170 Gateway baseline vs current shared worktree; read only",
        "frozenRef": frozen_ref,
        "routeRuleCounts": {"frozen": len(old_routes), "worktree": len(new_routes),
                            "added": len(new_routes.keys() - old_routes.keys()),
                            "removed": len(old_routes.keys() - new_routes.keys())},
        "addedRoutes": [{"ruleId": rule_id, **new_routes[rule_id]} for rule_id in sorted(new_routes.keys() - old_routes.keys())],
        "removedRoutes": sorted(old_routes.keys() - new_routes.keys()),
        "publicOperationCounts": {"frozen": len(old_paths), "worktree": len(new_paths),
                                  "added": len(new_paths - old_paths), "removed": len(old_paths - new_paths)},
        "executionPlanCounts": {"frozen": len(old["x-p1r-gateway-boundary"]["routeExecutions"]),
                                "worktree": len(new["x-p1r-gateway-boundary"]["routeExecutions"])},
        "availableOperationCounts": {"frozen": sum(info["status"] == "AVAILABLE" for info in old_exec.values()),
                                      "worktree": sum(info["status"] == "AVAILABLE" for info in new_exec.values()),
                                      "added": len(added_available), "removed": len(removed_available)},
        "newlyAvailableByRule": grouped(added_available),
        "noLongerAvailableByRule": grouped(removed_available),
        "addedPublicOperations": sorted([{"path": p, "method": m} for p, m in new_paths - old_paths],
                                        key=lambda item: (item["path"], item["method"])),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "routeRuleCounts": output["routeRuleCounts"],
                      "publicOperationCounts": output["publicOperationCounts"],
                      "executionPlanCounts": output["executionPlanCounts"],
                      "availableOperationCounts": output["availableOperationCounts"],
                      "addedRouteIds": [item["ruleId"] for item in output["addedRoutes"]],
                      "newlyAvailableByRule": {key: len(value) for key, value in output["newlyAvailableByRule"].items()}},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
