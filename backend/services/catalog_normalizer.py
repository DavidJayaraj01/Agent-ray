"""Catalog normalizer — extracts structured product data from raw/messy catalogs.

Uses local LLM (Ollama) when available, falls back to rule-based parsing.
"""
import json
import re
import os


def normalize_catalog(raw_text: str) -> list[dict]:
    """Parse raw catalog text into structured product dicts.

    Tries Ollama local LLM first, falls back to rule-based CSV/text parsing.
    Returns list of product dicts with confidence flags.
    """
    # Try Ollama local LLM
    try:
        from backend.services.llm_service import normalize_catalog_llm
        result = normalize_catalog_llm(raw_text)
        if result:
            return result
    except Exception:
        pass

    return _normalize_rule_based(raw_text)



def _normalize_rule_based(raw_text: str) -> list[dict]:
    """Fallback rule-based parser for CSV-like or semi-structured text."""
    products = []
    lines = raw_text.strip().split("\n")

    # Try to detect CSV header
    header = None
    data_start = 0
    if lines and any(sep in lines[0].lower() for sep in ["name", "product", "item"]):
        header_line = lines[0]
        sep = "," if "," in header_line else "\t" if "\t" in header_line else "|"
        header = [h.strip().lower().strip('"') for h in header_line.split(sep)]
        data_start = 1

    if header:
        import csv
        import io
        for i, line in enumerate(lines[data_start:], start=data_start):
            if not line.strip():
                continue
            sep = "\t" if "\t" in line and "," not in line else "|" if "|" in line and "," not in line else ","
            try:
                reader = csv.reader(io.StringIO(line), delimiter=sep)
                values = [v.strip() for v in next(reader)]
            except Exception:
                values = [v.strip().strip('"') for v in line.split(sep)]
            product = _map_csv_row(header, values, line)
            if product.get("name"):
                products.append(product)
    else:
        # Try line-by-line parsing for unstructured text
        for line in lines:
            if not line.strip():
                continue
            product = _parse_unstructured_line(line)
            if product.get("name"):
                products.append(product)

    return products


def _map_csv_row(header: list[str], values: list[str], raw_line: str) -> dict:
    """Map a CSV row to a product dict using fuzzy header matching."""
    row = dict(zip(header, values))

    name = _get_field(row, ["name", "product", "item", "title", "product_name", "item_name"])
    price = _parse_price(_get_field(row, ["price", "mrp", "cost", "rate", "amount"]))
    stock = _parse_int(_get_field(row, ["stock", "qty", "quantity", "available", "inventory"]))
    category = _get_field(row, ["category", "cat", "type", "department", "section"])
    delivery = _parse_int(_get_field(row, ["delivery", "delivery_days", "shipping", "tat", "days"]))
    returns = _get_field(row, ["return", "return_policy", "returns", "exchange"])

    # Confidence scoring
    confidence = {}
    confidence["name"] = 1.0 if name else 0.0
    confidence["price"] = 1.0 if price > 0 else 0.0
    confidence["stock"] = 0.8 if stock > 0 else 0.3
    confidence["category"] = 0.9 if category else 0.2
    confidence["delivery_days"] = 0.8 if delivery > 0 else 0.4
    confidence["return_policy"] = 0.8 if returns else 0.3

    needs_verification = any(v < 0.7 for v in confidence.values())

    # Try to extract variants from remaining fields
    variants = {}
    for key in ["color", "colour", "size", "variant", "colors", "sizes"]:
        if key in row and row[key]:
            variants[key] = row[key]

    return {
        "name": name or "Unknown Product",
        "price": price if price > 0 else 999,
        "stock": stock if stock > 0 else 10,
        "category": category or "General",
        "delivery_days": delivery if delivery > 0 else 7,
        "return_policy": returns or "No returns specified",
        "variants": variants,
        "confidence_flags": confidence,
        "needs_verification": needs_verification,
        "raw_text": raw_line,
    }


def _parse_unstructured_line(line: str) -> dict:
    """Try to extract product info from a free-text line."""
    # Look for price patterns like ₹1000, Rs 1000, INR 1000, 1000/-
    price_match = re.search(r'[₹$]?\s*(\d[\d,]*\.?\d*)\s*(?:/[-])?', line)
    price = _parse_price(price_match.group(1) if price_match else "0")

    # Remove price from line to get name
    name = line
    if price_match:
        name = line[:price_match.start()] + line[price_match.end():]
    name = re.sub(r'[₹$]|Rs\.?|INR|/-', '', name).strip(' -,|')

    if not name or len(name) < 2:
        return {}

    confidence = {
        "name": 0.7,
        "price": 0.8 if price > 0 else 0.2,
        "stock": 0.3,
        "category": 0.2,
        "delivery_days": 0.3,
        "return_policy": 0.2,
    }

    return {
        "name": name.strip(),
        "price": price if price > 0 else 999,
        "stock": 10,
        "category": "General",
        "delivery_days": 7,
        "return_policy": "No returns specified",
        "variants": {},
        "confidence_flags": confidence,
        "needs_verification": True,
        "raw_text": line,
    }


def _get_field(row: dict, aliases: list[str]) -> str:
    """Get a field value by trying multiple possible column names."""
    for alias in aliases:
        for key in row:
            if alias in key.lower():
                return str(row[key]).strip()
    return ""


def _parse_price(val: str) -> float:
    """Parse a price string into a float."""
    if not val:
        return 0.0
    cleaned = re.sub(r'[₹$,\s]|Rs\.?|INR|/-', '', val).strip()
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


def _parse_int(val: str) -> int:
    """Parse an integer from a string."""
    if not val:
        return 0
    cleaned = re.sub(r'[^\d]', '', val)
    try:
        return int(cleaned)
    except (ValueError, TypeError):
        return 0
