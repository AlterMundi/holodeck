#!/usr/bin/env python3
"""Check text addressed to the world for information that stays with the tribe.

Shape patterns (addresses, local paths, account identifiers) ship with this
script. Names come from an owner-held list that never enters a public record:
DAIMON_PRIVATE_TERMS (newline-separated) or the file named by
DAIMON_PRIVATE_TERMS_FILE, default ~/.config/daimon/private-terms.txt.

    audience_check.py --diff origin/main      # lines added since a base
    audience_check.py --staged                # lines about to be committed
    audience_check.py --tree origin/main      # audit every tracked file
    audience_check.py --text < message.txt    # a commit, issue or PR text

Use --mask where the output itself is public, such as CI logs of a public
repository. An accepted finding is recorded in .audience-allow as
`category<TAB>path<TAB>exact text`.
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

SHAPES = {
    "private-address": re.compile(
        r"(?<![\d.])(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?!\d|\.\d)"
    ),
    "local-path": re.compile(r"/home/[a-z_][a-z0-9_-]*/"),
    "chat-id": re.compile(r"(?:chat[_-]?id|telegram:)\D{0,6}(-?\d{8,13})", re.I),
    "bot-token": re.compile(r"\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b"),
}
GENERIC_PATHS = ("/home/user/", "/home/agent/", "/home/runner/", "/home/example/")


def load_terms():
    raw = os.environ.get("DAIMON_PRIVATE_TERMS")
    if raw is None:
        path = Path(
            os.environ.get("DAIMON_PRIVATE_TERMS_FILE")
            or Path.home() / ".config/daimon/private-terms.txt"
        )
        raw = path.read_text() if path.is_file() else ""
    terms = [t.strip() for t in raw.splitlines() if t.strip() and not t.startswith("#")]
    if not terms:
        return None
    alternatives = "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True))
    return re.compile(rf"(?<![\w-])(?:{alternatives})(?![\w-])", re.I)


def findings(text, patterns):
    for number, line in enumerate(text.splitlines(), 1):
        for category, pattern in patterns.items():
            for match in pattern.finditer(line):
                found = match.group(0)
                if category == "local-path" and found in GENERIC_PATHS:
                    continue
                yield number, category, found


def git(*args):
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True, errors="replace"
    ).stdout


def added_lines(diff):
    """Yield (path, text of added lines) from a unified diff."""
    path, lines = None, []
    for line in diff.splitlines():
        if line.startswith("+++ "):
            if path and lines:
                yield path, "\n".join(lines)
            path, lines = line[6:] if line.startswith("+++ b/") else None, []
        elif path and line.startswith("+") and not line.startswith("+++"):
            lines.append(line[1:])
    if path and lines:
        yield path, "\n".join(lines)


def sources(args):
    if args.text:
        yield "<text>", sys.stdin.read()
    elif args.staged:
        yield from added_lines(git("diff", "--cached", "--unified=0", "--no-color"))
    elif args.diff:
        yield from added_lines(git("diff", "--unified=0", "--no-color", f"{args.diff}...HEAD"))
        yield "<commit messages>", git("log", "--format=%B", f"{args.diff}..HEAD")
    else:
        for path in git("ls-tree", "-r", "--name-only", args.tree).splitlines():
            blob = subprocess.run(
                ["git", "show", f"{args.tree}:{path}"], capture_output=True
            ).stdout
            if b"\0" not in blob[:8000]:
                yield path, blob.decode(errors="replace")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--diff", metavar="BASE")
    mode.add_argument("--staged", action="store_true")
    mode.add_argument("--tree", metavar="REV")
    mode.add_argument("--text", action="store_true")
    parser.add_argument("--mask", action="store_true")
    parser.add_argument("--require-terms", action="store_true",
                        help="fail when the owner-held name list is unavailable")
    args = parser.parse_args(argv)

    patterns = dict(SHAPES)
    terms = load_terms()
    if terms:
        patterns["tribe-name"] = terms
    elif args.require_terms:
        print("audience_check: the owner-held name list is unavailable", file=sys.stderr)
        return 2

    allow = set()
    if Path(".audience-allow").is_file():
        allow = {tuple(l.split("\t")) for l in Path(".audience-allow").read_text().splitlines()}

    count = 0
    for path, text in sources(args):
        if path == ".audience-allow":
            continue
        for number, category, found in findings(text, patterns):
            if (category, path, found) in allow:
                continue
            count += 1
            shown = "…" if args.mask else found
            print(f"{path}:{number}: {category}: {shown}")
    if count:
        print(f"audience_check: {count} finding(s) addressed to the world", file=sys.stderr)
    elif not terms:
        print("audience_check: shapes only; no owner-held name list found", file=sys.stderr)
    return 1 if count else 0


if __name__ == "__main__":
    sys.exit(main())
