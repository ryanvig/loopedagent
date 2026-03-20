"""Extract Pydantic schemas from the Looped backend into YAML."""

from __future__ import annotations

import ast

from _common import LOOPED_ROOT, ast_name, iter_python_files, parse_module, relpath, write_yaml

SCHEMAS_ROOT = LOOPED_ROOT / "backend/app/schemas"


def _is_schema_class(node: ast.ClassDef) -> bool:
    for base in node.bases:
        name = ast_name(base) or ""
        if name.endswith("BaseModel"):
            return True
    return False


def extract_schemas() -> dict[str, dict[str, object]]:
    schemas: dict[str, dict[str, object]] = {}
    for path in iter_python_files(SCHEMAS_ROOT):
        module = parse_module(path)
        for node in module.body:
            if not isinstance(node, ast.ClassDef) or not _is_schema_class(node):
                continue
            fields: list[dict[str, object]] = []
            for item in node.body:
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    fields.append(
                        {
                            "name": item.target.id,
                            "type": ast_name(item.annotation) or "Any",
                        }
                    )
            schemas[node.name] = {
                "file": relpath(path),
                "fields": sorted(fields, key=lambda field: str(field["name"])),
            }
    return dict(sorted(schemas.items(), key=lambda item: item[0]))


def main() -> None:
    schemas = extract_schemas()
    out = write_yaml("schemas.yaml", {"schemas": schemas})
    print(f"Wrote {len(schemas)} schemas to {out}")


if __name__ == "__main__":
    main()

