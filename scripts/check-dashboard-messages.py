"""Check every literal dashboard message key resolves in both locales.

TypeScript cannot see these — the project has no next-intl type augmentation —
so a wrong namespace only shows up as an IntlError at runtime, on whichever
screen happens to render it.

A file often holds several components, each with its own `const t =
useTranslations(...)` on a different namespace, so the source is split at
top-level `function` declarations and each block resolved against the
translators declared inside it. Template keys (`t(`nav.${key}`)`) are skipped:
they cannot be resolved statically.

Run from the repo root.
"""

import json
import pathlib
import re
import sys


def flatten(node, prefix=""):
    keys = set()
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            keys |= flatten(value, path + ".")
        else:
            keys.add(path)
    return keys


def load(locale):
    raw = json.loads(pathlib.Path(f"messages/{locale}/dashboard.json").read_text())
    # Sources address the namespace as "dashboard.…", matching the provider.
    return {f"dashboard.{key}" for key in flatten(raw)}


DECL = re.compile(r'const\s+(\w+)\s*=\s*useTranslations\(\s*"([^"]+)"\s*\)')
CALL = re.compile(r'\b(\w+)(?:\.rich)?\(\s*"([^"{}$]+)"')
# A top-level function starts a new scope.
TOP_LEVEL_FN = re.compile(r'^(?:export\s+default\s+)?function\s', re.M)

roots = [pathlib.Path("app/(dashboard)"), pathlib.Path("app/components/dashboard")]
files = sorted(f for root in roots for f in root.rglob("*.tsx"))

en, es = load("en"), load("es")
problems = []
checked = 0

for file in files:
    source = file.read_text()
    starts = [m.start() for m in TOP_LEVEL_FN.finditer(source)]
    if not starts:
        continue
    bounds = list(zip([0] + starts, starts + [len(source)]))

    for start, end in bounds:
        block = source[start:end]
        translators = dict(DECL.findall(block))
        if not translators:
            continue
        for name, key in CALL.findall(block):
            namespace = translators.get(name)
            if namespace is None:
                continue
            checked += 1
            full = f"{namespace}.{key}"
            missing = [loc for loc, keys in (("en", en), ("es", es)) if full not in keys]
            if missing:
                problems.append(
                    f'{file}: {name}("{key}") → {full} missing in {", ".join(missing)}'
                )

if problems:
    print(f"{len(problems)} unresolved key(s):")
    for problem in problems:
        print("  " + problem)
    sys.exit(1)

print(f"all {checked} literal keys resolve in both locales ({len(files)} files)")
