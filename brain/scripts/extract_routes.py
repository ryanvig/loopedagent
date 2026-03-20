"""Extract FastAPI routes from the Looped backend into YAML."""

from __future__ import annotations

import ast
from pathlib import Path

from _common import LOOPED_ROOT, ast_name, iter_python_files, parse_module, relpath, write_yaml

ROUTES_ROOT = LOOPED_ROOT / "backend/app/routes"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}


def _router_prefixes(module: ast.Module) -> dict[str, str]:
    prefixes: dict[str, str] = {}
    for node in module.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            target = node.targets[0].id
            if isinstance(node.value, ast.Call) and ast_name(node.value.func) == "APIRouter":
                prefix = ""
                for kw in node.value.keywords:
                    if kw.arg == "prefix" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                        prefix = kw.value.value
                prefixes[target] = prefix
    return prefixes


def _extract_dep_name(arg: ast.arg) -> str | None:
    default = None
    # defaults are aligned separately; handled by caller
    if arg.annotation:
        _ = ast_name(arg.annotation)
    return default


def _auth_from_function(fn: ast.AsyncFunctionDef | ast.FunctionDef) -> tuple[str, list[str]]:
    args = fn.args.args + fn.args.kwonlyargs
    defaults = [None] * (len(args) - len(fn.args.defaults) - len(fn.args.kw_defaults or []))
    pos_defaults = list(fn.args.defaults)
    kw_defaults = list(fn.args.kw_defaults or [])
    all_defaults = [None] * (len(fn.args.args) - len(pos_defaults)) + pos_defaults + kw_defaults

    deps: list[str] = []
    for arg, default in zip(args, all_defaults):
        if isinstance(default, ast.Call) and ast_name(default.func) == "Depends":
            dep_name = ast_name(default.args[0]) if default.args else None
            if dep_name:
                deps.append(dep_name)

    auth_keywords = (
        "get_current_user",
        "get_current_active_user",
        "get_current_admin",
        "require_",
        "oauth2_scheme",
    )
    auth_deps = [d for d in deps if any(key in d for key in auth_keywords)]
    if not auth_deps:
        return "none", deps
    return auth_deps[0], deps


def _decorator_route_info(decorator: ast.AST, prefixes: dict[str, str]) -> tuple[str, list[str]] | None:
    if not isinstance(decorator, ast.Call):
        return None
    if not isinstance(decorator.func, ast.Attribute):
        return None
    method = decorator.func.attr.lower()
    if method not in HTTP_METHODS:
        return None
    router_name = ast_name(decorator.func.value)
    prefix = prefixes.get(router_name or "", "")
    route_path = ""
    if decorator.args and isinstance(decorator.args[0], ast.Constant) and isinstance(decorator.args[0].value, str):
        route_path = decorator.args[0].value
    full_path = f"{prefix}{route_path}" or "/"
    return full_path, [method.upper()]


def extract_routes() -> list[dict[str, object]]:
    routes: list[dict[str, object]] = []
    for path in iter_python_files(ROUTES_ROOT):
        module = parse_module(path)
        prefixes = _router_prefixes(module)
        for node in module.body:
            if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
                continue
            for decorator in node.decorator_list:
                info = _decorator_route_info(decorator, prefixes)
                if not info:
                    continue
                full_path, methods = info
                auth, dependencies = _auth_from_function(node)
                route: dict[str, object] = {
                    "path": full_path,
                    "methods": methods,
                    "auth": auth,
                    "file": relpath(path),
                    "handler": node.name,
                }
                if dependencies:
                    route["dependencies"] = sorted(set(dependencies))
                routes.append(route)
    routes.sort(key=lambda item: (str(item["path"]), ",".join(item["methods"]), str(item["file"])))
    return routes


def main() -> None:
    routes = extract_routes()
    out = write_yaml("routes.yaml", {"routes": routes})
    print(f"Wrote {len(routes)} routes to {out}")


if __name__ == "__main__":
    main()

