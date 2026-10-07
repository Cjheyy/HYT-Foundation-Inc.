"""Collapse the triplicated 'On-gradient text correction' block in src/index.css.

The generator emitted the same 28-line block three times.  This asserts the three
copies are byte-identical before removing two of them, so it can never silently
delete something that was not a duplicate.
"""
import io
import sys

PATH = "src/index.css"

with io.open(PATH, "r", encoding="utf-8", newline="") as fh:
    raw = fh.read()

# Preserve the file's own line ending.
eol = "\r\n" if "\r\n" in raw else "\n"
lines = raw.split(eol)

# 0-based: block A = 957..984, blank 985, B = 986..1013, blank 1014,
# C = 1015..1042, blank 1043, marker at 1044.
a = lines[957:985]
b = lines[986:1014]
c = lines[1015:1043]

if not (len(a) == len(b) == len(c) == 28):
    sys.exit("ABORT: expected three 28-line blocks, got %d/%d/%d" % (len(a), len(b), len(c)))
if not (a == b == c):
    sys.exit("ABORT: the three blocks are NOT identical — refusing to delete anything")

if "On-gradient text correction" not in eol.join(a):
    sys.exit("ABORT: line offsets no longer point at the expected block")

# Keep block A (+ its trailing blank), drop B, blank, C, blank.
new_lines = lines[:986] + lines[1044:]

with io.open(PATH, "w", encoding="utf-8", newline="") as fh:
    fh.write(eol.join(new_lines))

print("OK: removed 2 duplicate copies (%d lines dropped)" % (len(lines) - len(new_lines)))
