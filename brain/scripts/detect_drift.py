"""Detect drift between the current Looped codebase and stored knowledge files."""

from __future__ import annotations

from extract_models import extract_models
from extract_routes import extract_routes
from extract_schemas import extract_schemas
from refresh_repo_map import build_repo_map


def _load_text(path):
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def _load_admin_override_routes(path):
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    routes: list[str] = []
    current_path = None
    for raw in lines:
        line = raw.strip()
        if line.startswith("- path:"):
            current_path = line.split(":", 1)[1].strip().strip('"').strip("'")
        elif current_path and line.startswith("verified_auth:"):
            routes.append(current_path)
            current_path = None
    return routes


def main() -> None:
    from _common import KNOWLEDGE_DIR, dump_yaml

    current = {
        "routes": dump_yaml({"routes": extract_routes()}),
        "models": dump_yaml({"models": extract_models()}),
        "schemas": dump_yaml({"schemas": extract_schemas()}),
        "repo_map": dump_yaml(build_repo_map()),
    }

    stored = {
        "routes": _load_text(KNOWLEDGE_DIR / "routes.yaml"),
        "models": _load_text(KNOWLEDGE_DIR / "models.yaml"),
        "schemas": _load_text(KNOWLEDGE_DIR / "schemas.yaml"),
        "repo_map": _load_text(KNOWLEDGE_DIR / "repo_map.yaml"),
    }

    admin_override_file = KNOWLEDGE_DIR / "admin_audit_overrides.yaml"
    admin_override_routes = _load_admin_override_routes(admin_override_file)

    changes: list[str] = []
    for key in ("routes", "models", "schemas", "repo_map"):
        if stored[key] is None:
            changes.append(f"- Missing knowledge file: {key}.yaml")
        elif stored[key] != current[key]:
            changes.append(f"- Drift detected in {key}.yaml")
            if key == "routes" and admin_override_routes:
                changes.append(
                    f"- Admin route auth includes {len(admin_override_routes)} verified overrides from admin_audit_overrides.yaml"
                )

    if not admin_override_file.exists():
        changes.append("- Missing knowledge file: admin_audit_overrides.yaml")

    if changes:
        print("## Drift Detected\n")
        for line in changes:
            print(line)
        if admin_override_routes:
            print("\n## Verified Admin Overrides")
            for path in admin_override_routes:
                print(f"- {path}")
    else:
        print("## No Drift Detected")


if __name__ == "__main__":
    main()
