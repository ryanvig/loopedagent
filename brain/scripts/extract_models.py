"""Extract SQLAlchemy models from the Looped backend into YAML."""

from __future__ import annotations

import ast
from pathlib import Path

from _common import LOOPED_ROOT, ast_name, iter_python_files, literal_value, parse_module, relpath, write_yaml

MODELS_ROOT = LOOPED_ROOT / "backend/app/models"


def _is_model_class(node: ast.ClassDef) -> bool:
    return any((ast_name(base) or "").endswith("Base") for base in node.bases)


def _column_info(name: str, call: ast.Call) -> dict[str, object]:
    info: dict[str, object] = {"name": name}
    if call.args:
        first = call.args[0]
        if not (isinstance(first, ast.Constant) and isinstance(first.value, str)):
            info["type"] = ast_name(first) or "unknown"
    for kw in call.keywords:
        if kw.arg == "nullable":
            info["nullable"] = bool(literal_value(kw.value))
        elif kw.arg == "default":
            info["default"] = literal_value(kw.value)
        elif kw.arg == "primary_key":
            info["primary_key"] = bool(literal_value(kw.value))
        elif kw.arg == "unique":
            info["unique"] = bool(literal_value(kw.value))
    return info


def _relationship_info(name: str, call: ast.Call) -> dict[str, object]:
    info: dict[str, object] = {"name": name}
    if call.args:
        info["target"] = literal_value(call.args[0])
    for kw in call.keywords:
        if kw.arg in {"back_populates", "backref"}:
            info["backref"] = literal_value(kw.value)
    return info


def extract_models() -> dict[str, dict[str, object]]:
    models: dict[str, dict[str, object]] = {}
    for path in iter_python_files(MODELS_ROOT):
        module = parse_module(path)
        for node in module.body:
            if not isinstance(node, ast.ClassDef) or not _is_model_class(node):
                continue
            model: dict[str, object] = {
                "file": relpath(path),
                "table": None,
                "fields": [],
                "relationships": [],
            }
            for item in node.body:
                if isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name) and target.id == "__tablename__":
                            model["table"] = literal_value(item.value)
                        elif isinstance(target, ast.Name) and isinstance(item.value, ast.Call):
                            call_name = ast_name(item.value.func)
                            if call_name == "Column":
                                model["fields"].append(_column_info(target.id, item.value))  # type: ignore[arg-type]
                            elif call_name == "relationship":
                                model["relationships"].append(_relationship_info(target.id, item.value))  # type: ignore[arg-type]
                elif isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name) and isinstance(item.value, ast.Call):
                    call_name = ast_name(item.value.func)
                    if call_name == "Column":
                        model["fields"].append(_column_info(item.target.id, item.value))  # type: ignore[arg-type]
                    elif call_name == "relationship":
                        model["relationships"].append(_relationship_info(item.target.id, item.value))  # type: ignore[arg-type]
            model["fields"] = sorted(model["fields"], key=lambda field: str(field["name"]))  # type: ignore[index]
            model["relationships"] = sorted(model["relationships"], key=lambda rel: str(rel["name"]))  # type: ignore[index]
            models[node.name] = model
    return dict(sorted(models.items(), key=lambda item: item[0]))


def main() -> None:
    models = extract_models()
    out = write_yaml("models.yaml", {"models": models})
    print(f"Wrote {len(models)} models to {out}")


if __name__ == "__main__":
    main()

