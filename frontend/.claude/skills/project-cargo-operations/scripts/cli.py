#!/usr/bin/env python3
"""JSON command-line entry for the project-cargo calculators.

Usage:
  python3 cli.py list                          # all functions with their first docstring line
  python3 cli.py help <function>               # full docstring + parameters
  python3 cli.py <function> '<json kwargs>'    # run, prints JSON result
Example:
  python3 cli.py anti_heeling_ballast '{"cargo_t":474,"gear_t":26,"boom_q_t":64.1,"half_breadth_m":10.1,"outreach_m":6.3,"tank_distance_m":18.2}'
"""
import inspect
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bedding_calcs  # noqa: E402
import lifting_calcs  # noqa: E402
import securing_balance_calcs  # noqa: E402
import securing_equipment_calcs  # noqa: E402
import stability_calcs  # noqa: E402

MODULES = (lifting_calcs, stability_calcs, bedding_calcs, securing_equipment_calcs, securing_balance_calcs)


def registry():
    """Public functions defined in the calculator modules (helpers imported from calc_common excluded)."""
    funcs = {}
    for module in MODULES:
        for name, fn in inspect.getmembers(module, inspect.isfunction):
            if not name.startswith("_") and fn.__module__ == module.__name__:
                funcs[name] = fn
    return funcs


def main(argv):
    funcs = registry()
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[1] == "list":
        for name, fn in sorted(funcs.items()):
            print(f"{fn.__module__}.{name}: {(fn.__doc__ or '').strip().splitlines()[0]}")
        return 0
    if argv[1] == "help" and len(argv) == 2:
        print(__doc__)
        return 0
    if argv[1] == "help":
        fn = funcs.get(argv[2])
        if fn is None:
            print(f"unknown function: {argv[2]}", file=sys.stderr)
            return 2
        print(f"{argv[2]}{inspect.signature(fn)}\n\n{inspect.getdoc(fn)}")
        return 0
    fn = funcs.get(argv[1])
    if fn is None:
        print(f"unknown function: {argv[1]} (run 'list')", file=sys.stderr)
        return 2
    try:
        kwargs = json.loads(argv[2]) if len(argv) > 2 else {}
        if not isinstance(kwargs, dict):
            raise ValueError("arguments must be a JSON object")
        print(json.dumps(fn(**kwargs), indent=2))
        return 0
    except (ValueError, TypeError, KeyError, ArithmeticError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
