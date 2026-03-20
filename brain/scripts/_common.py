"""Shared helpers for Looped knowledge extraction scripts."""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

LOOPED_ROOT = Path("/Users/ryanvig/Desktop/Looped")
SCRIPT_DIR = Path(__file__).resolve().parent
KNOWLEDGE_DIR = (SCRIPT_DIR / "../knowledge").resolve()


def ensure_knowledge_dir() -> None:
    """Create the knowledge directory if it does not already exist."""
    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)


def relpath(path: Path) -> str:
    """Return a Looped-root-relative path when possible."""
    try:
        return path.resolve().relative_to(LOOPED_ROOT.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def read_text(path: Path) -> str:
    """Read UTF-8 text safely."""
    return path.read_text(encoding="utf-8")


def parse_module(path: Path) -> ast.Module:
    """Parse a Python file into an AST module."""
    return ast.parse(read_text(path), filename=str(path))


def iter_python_files(root: Path) -> list[Path]:
    """Return sorted Python files under a root, excluding caches."""
    return sorted(
        p
        for p in root.rglob("*.py")
        if "__pycache__" not in p.parts and not p.name.startswith(".")
    )


def ast_name(node: ast.AST | None) -> str | None:
    """Best-effort human-readable name for an AST node."""
    if node is None:
        return None
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = ast_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    if isinstance(node, ast.Constant):
        return repr(node.value)
    if isinstance(node, ast.Call):
        func = ast_name(node.func)
        args = ", ".join(filter(None, (ast_name(arg) for arg in node.args)))
        return f"{func}({args})" if func else None
    if isinstance(node, ast.Subscript):
        base = ast_name(node.value)
        sub = ast_name(node.slice)
        return f"{base}[{sub}]" if base and sub else (base or sub)
    if isinstance(node, ast.Tuple):
        return ", ".join(filter(None, (ast_name(elt) for elt in node.elts)))
    if isinstance(node, ast.List):
        return ", ".join(filter(None, (ast_name(elt) for elt in node.elts)))
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        left = ast_name(node.left)
        right = ast_name(node.right)
        if left and right:
            return f"{left} | {right}"
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        operand = ast_name(node.operand)
        return f"-{operand}" if operand else None
    try:
        return ast.unparse(node)
    except Exception:
        return None


def literal_value(node: ast.AST | None) -> Any:
    """Best-effort literal extraction from an AST node."""
    if node is None:
        return None
    try:
        return ast.literal_eval(node)
    except Exception:
        return ast_name(node)


def yaml_scalar(value: Any) -> str:
    """Serialize a scalar YAML value."""
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        if value == "":
            return '""'
        needs_quotes = any(ch in value for ch in [":", "#", "-", "{", "}", "[", "]", ",", "&", "*", "?", "|", ">", "%", "@", "`", '"', "'"]) or value.strip() != value or "\n" in value
        if value.lower() in {"true", "false", "null", "yes", "no"}:
            needs_quotes = True
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"' if needs_quotes else value
    return yaml_scalar(str(value))


def _dump_yaml_lines(value: Any, indent: int = 0) -> list[str]:
    pad = " " * indent
    if isinstance(value, dict):
        lines: list[str] = []
        for key in sorted(value):
            item = value[key]
            if isinstance(item, (dict, list)):
                lines.append(f"{pad}{key}:")
                lines.extend(_dump_yaml_lines(item, indent + 2))
            else:
                lines.append(f"{pad}{key}: {yaml_scalar(item)}")
        return lines
    if isinstance(value, list):
        lines = []
        for item in value:
            if isinstance(item, dict):
                keys = list(item.keys())
                if not keys:
                    lines.append(f"{pad}- {{}}")
                    continue
                first_key = keys[0]
                first_val = item[first_key]
                if isinstance(first_val, (dict, list)):
                    lines.append(f"{pad}- {first_key}:")
                    lines.extend(_dump_yaml_lines(first_val, indent + 4))
                else:
                    lines.append(f"{pad}- {first_key}: {yaml_scalar(first_val)}")
                for key in keys[1:]:
                    val = item[key]
                    if isinstance(val, (dict, list)):
                        lines.append(f"{pad}  {key}:")
                        lines.extend(_dump_yaml_lines(val, indent + 4))
                    else:
                        lines.append(f"{pad}  {key}: {yaml_scalar(val)}")
            elif isinstance(item, list):
                lines.append(f"{pad}-")
                lines.extend(_dump_yaml_lines(item, indent + 2))
            else:
                lines.append(f"{pad}- {yaml_scalar(item)}")
        return lines
    return [f"{pad}{yaml_scalar(value)}"]


def dump_yaml(data: Any) -> str:
    """Serialize Python data to deterministic YAML."""
    return "\n".join(_dump_yaml_lines(data)) + "\n"


def write_yaml(filename: str, data: Any) -> Path:
    """Write deterministic YAML data to the knowledge directory."""
    ensure_knowledge_dir()
    out_path = KNOWLEDGE_DIR / filename
    out_path.write_text(dump_yaml(data), encoding="utf-8")
    return out_path

