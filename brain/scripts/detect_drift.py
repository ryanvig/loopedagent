"""Detect drift between the current Looped codebase and stored knowledge files."""

from __future__ import annotations

from extract_models import extract_models
from extract_routes import extract_routes
from refresh_repo_map import build_repo_map


def _load_text(path):
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def main() -> None:
    from _common import KNOWLEDGE_DIR, dump_yaml

    current = {
        "routes": dump_yaml({"routes": extract_routes()}),
        "models": dump_yaml({"models": extract_models()}),
        "repo_map": dump_yaml(build_repo_map()),
    }

    stored = {
        "routes": _load_text(KNOWLEDGE_DIR / "routes.yaml"),
        "models": _load_text(KNOWLEDGE_DIR / "models.yaml"),
        "repo_map": _load_text(KNOWLEDGE_DIR / "repo_map.yaml"),
    }

    changes: list[str] = []
    for key in ("routes", "models", "repo_map"):
        if stored[key] is None:
            changes.append(f"- Missing knowledge file: {key}.yaml")
        elif stored[key] != current[key]:
            changes.append(f"- Drift detected in {key}.yaml")

    if changes:
        print("## Drift Detected\n")
        for line in changes:
            print(line)
    else:
        print("## No Drift Detected")


if __name__ == "__main__":
    main()

