"""Generate a machine-readable repo map for the Looped codebase."""

from __future__ import annotations

from pathlib import Path

from _common import LOOPED_ROOT, relpath, write_yaml


def _list_names(root: Path, pattern: str) -> list[str]:
    return sorted(p.name for p in root.glob(pattern) if p.is_file())


def _list_relative(root: Path, pattern: str) -> list[str]:
    return sorted(relpath(p) for p in root.glob(pattern) if p.is_file())


def build_repo_map() -> dict[str, object]:
    backend = LOOPED_ROOT / "backend/app"
    mobile = LOOPED_ROOT / "mobile/src"
    frontend = LOOPED_ROOT / "frontend/app"
    return {
        "backend": {
            "routes": _list_names(backend / "routes", "*.py"),
            "models": _list_names(backend / "models", "*.py"),
            "schemas": _list_names(backend / "schemas", "*.py"),
            "services": _list_names(backend / "services", "*.py"),
            "utils": _list_names(backend / "utils", "*.py"),
            "migrations": _list_relative(LOOPED_ROOT / "backend/alembic/versions", "*.py"),
        },
        "mobile": {
            "api": relpath(LOOPED_ROOT / "mobile/src/lib/api.ts"),
            "navigation": _list_relative(LOOPED_ROOT / "mobile/src/navigation", "*.tsx"),
            "screens": _list_relative(LOOPED_ROOT / "mobile/src/screens", "*.tsx"),
            "components": _list_relative(LOOPED_ROOT / "mobile/src/components", "*.tsx"),
            "contexts": _list_relative(LOOPED_ROOT / "mobile/src/contexts", "*.tsx"),
        },
        "frontend": {
            "pages": _list_relative(frontend, "**/page.tsx"),
            "layouts": _list_relative(frontend, "**/layout.tsx"),
            "routes": sorted(
                {
                    relpath(p.parent if p.name == "page.tsx" else p)
                    for p in frontend.rglob("page.tsx")
                }
            ),
        },
        "root_docs": sorted(
            p.name for p in LOOPED_ROOT.glob("*.md") if p.is_file()
        ),
    }


def main() -> None:
    repo_map = build_repo_map()
    out = write_yaml("repo_map.yaml", repo_map)
    print(f"Wrote repo map to {out}")


if __name__ == "__main__":
    main()

