"""Allowlist-based SVG sanitizer for LLM-generated lesson diagrams (v6.1).

Security is non-negotiable: this is deny-by-default. Anything not on the element
and attribute allowlists is a hard rejection (no silent stripping), which feeds
the generation retry loop. Uses only the standard library so it adds no
dependency to the API image; the parser is hardened against entity-expansion and
external-reference attacks at the raw-string level before any XML parsing.

Returns ``(ok, errors, svg)``. Only ``ok=True`` output is ever persisted, and the
client injects it through a second light sanitize pass as defence-in-depth.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

# Max diagram canvas (viewBox width x height).
MAX_VIEWBOX_W = 800.0
MAX_VIEWBOX_H = 400.0

_SVG_NS = "http://www.w3.org/2000/svg"

# Element allowlist (local names, namespace-stripped).
ALLOWED_TAGS = {
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
    "polygon", "text", "tspan", "defs", "linearGradient", "radialGradient",
    "stop", "title", "desc",
}

# Attribute allowlist (local names). Geometry + presentation only.
ALLOWED_ATTRS = {
    "viewbox", "xmlns", "width", "height", "fill", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity",
    "fill-opacity", "stroke-opacity", "transform", "d", "points",
    "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
    "width", "height", "font-size", "font-family", "font-weight",
    "text-anchor", "dominant-baseline", "offset", "stop-color", "stop-opacity",
    "gradientunits", "gradienttransform", "id", "class",
}

# Raw-string red flags — rejected before parsing (no parser ever sees them).
_RAW_FORBIDDEN = (
    re.compile(r"<!DOCTYPE", re.IGNORECASE),
    re.compile(r"<!ENTITY", re.IGNORECASE),
    re.compile(r"<\?xml-stylesheet", re.IGNORECASE),
    re.compile(r"<script", re.IGNORECASE),
    re.compile(r"<foreignObject", re.IGNORECASE),
    re.compile(r"<image", re.IGNORECASE),
    re.compile(r"\son\w+\s*=", re.IGNORECASE),       # onload=, onclick=, ...
    re.compile(r"javascript:", re.IGNORECASE),
)

# Forbidden substrings inside any attribute value.
_VALUE_FORBIDDEN = (
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"expression\s*\(", re.IGNORECASE),
    re.compile(r"url\s*\(\s*['\"]?\s*(?:https?:|//|data:)", re.IGNORECASE),
    re.compile(r"@import", re.IGNORECASE),
    re.compile(r"<", re.IGNORECASE),
)


def _local(name: str) -> str:
    """Strip an XML namespace and lowercase the local tag/attr name."""
    if "}" in name:
        name = name.split("}", 1)[1]
    return name.lower()


def _check_viewbox(root: ET.Element, errors: list[str]) -> None:
    vb = None
    for k, v in root.attrib.items():
        if _local(k) == "viewbox":
            vb = v
            break
    if vb is None:
        errors.append("root <svg> must declare a viewBox")
        return
    parts = re.split(r"[ ,]+", vb.strip())
    if len(parts) != 4:
        errors.append("viewBox must have 4 numbers")
        return
    try:
        _, _, w, h = (float(p) for p in parts)
    except ValueError:
        errors.append("viewBox values must be numeric")
        return
    if w <= 0 or h <= 0:
        errors.append("viewBox width/height must be positive")
    if w > MAX_VIEWBOX_W or h > MAX_VIEWBOX_H:
        errors.append(
            f"viewBox {w:g}x{h:g} exceeds max {MAX_VIEWBOX_W:g}x{MAX_VIEWBOX_H:g}"
        )


def sanitize_svg(svg: str) -> tuple[bool, list[str], str]:
    """Validate ``svg`` against the allowlist. Returns (ok, errors, svg)."""
    errors: list[str] = []
    text = (svg or "").strip()
    if not text:
        return False, ["empty SVG"], ""

    for pat in _RAW_FORBIDDEN:
        if pat.search(text):
            errors.append(f"forbidden construct matching /{pat.pattern}/")
    if errors:
        return False, errors, ""

    # Parse with a plain (non-validating, no-network) ElementTree parser. The
    # raw-string DOCTYPE/ENTITY guard above already blocks the XXE vectors.
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        return False, [f"SVG does not parse: {exc}"], ""

    if _local(root.tag) != "svg":
        return False, ["root element must be <svg>"], ""

    _check_viewbox(root, errors)

    for el in root.iter():
        tag = _local(el.tag)
        if tag not in ALLOWED_TAGS:
            errors.append(f"disallowed element <{tag}>")
            continue
        for attr, val in el.attrib.items():
            la = _local(attr)
            # xmlns / namespace declarations arrive as bare or xml-ns attrs.
            if la in ("xmlns", "space") or attr.startswith("{http://www.w3.org/XML/"):
                continue
            if la.startswith("xmlns"):
                continue
            if la not in ALLOWED_ATTRS:
                errors.append(f"disallowed attribute '{la}' on <{tag}>")
                continue
            for pat in _VALUE_FORBIDDEN:
                if pat.search(val):
                    errors.append(f"disallowed value in '{la}': matches /{pat.pattern}/")

    # Reject any namespace other than SVG (e.g. embedded xhtml/xlink href targets).
    for el in root.iter():
        if "}" in el.tag:
            ns = el.tag.split("}", 1)[0].lstrip("{")
            if ns != _SVG_NS:
                errors.append(f"foreign namespace not allowed: {ns}")

    if errors:
        return False, sorted(set(errors)), ""
    return True, [], text
