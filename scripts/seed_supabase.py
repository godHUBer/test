#!/usr/bin/env python3
"""Seed the Supabase project from assets/data/inventory.json.

Generates idempotent SQL — one brand_settings row plus one multi-row cars INSERT,
every statement armed with ON CONFLICT DO NOTHING — and prints it to stdout
(or writes it with --out FILE). Execute the output against the project with the
Supabase connector's execute_query, or with psql. Re-running is always safe:
existing rows are never overwritten, so any admin edits made after the first seed
survive a re-seed. To force the JSON values back over the database, use
sync_db.py's --force direction instead (see that file).

The database holds the admin-editable facts only: static-site copy that no admin
workflow changes (established, ledBy, sourceInventory, sourceSite, social) stays
in inventory.json / build.py and is deliberately not seeded.

Usage:
    python3 scripts/seed_supabase.py                # print SQL
    python3 scripts/seed_supabase.py --out /tmp/seed.sql
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "assets/data/inventory.json").read_text(encoding="utf-8"))


def q(v) -> str:
    """SQL literal for a JSON value (None → NULL, apostrophes doubled)."""
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def arr(items) -> str:
    """SQL literal for a text[] from a JSON list of strings."""
    if not items:
        return "'{}'::text[]"
    inner = ",".join(
        '"' + str(i).replace("\\", "\\\\").replace('"', '\\"').replace("'", "''") + '"'
        for i in items
    )
    return "'{" + inner + "}'::text[]"


def brand_sql() -> str:
    b = DATA["brand"]
    cols = ("id, name, tagline, phone_display, phone_href, email, address_short, "
            "address_city, area, map_url, services, hours, verified_on")
    values = ", ".join([
        "1",
        q(b["name"]), q(b["tagline"]), q(b["phoneDisplay"]), q(b["phoneHref"]),
        q(b["email"]), q(b["addressShort"]), q(b["addressCity"]), q(b["area"]),
        q(b["mapUrl"]), arr(b["services"]), q(b["hours"]), q(b["verifiedOn"]),
    ])
    return (f"insert into public.brand_settings ({cols}) values ({values})\n"
            "on conflict (id) do nothing;")


def cars_sql() -> str:
    cols = ("id, sort_order, featured, status, year, make, model, variant, km, fuel, "
            "transmission, body, price_lakh, price_note, reg, location, highlights, "
            "listing_url, overview, photo_stock, photos_gallery")
    rows = []
    for i, c in enumerate(DATA["cars"]):
        vals = ", ".join([
            q(c["id"]),
            str((i + 1) * 10),          # sort_order mirrors the JSON array order
            "true" if c.get("featured") else "false",
            "'available'",              # JSON carries no status yet
            str(c["year"]), q(c["make"]), q(c["model"]), q(c["variant"]),
            str(c["km"]), q(c["fuel"]), q(c["transmission"]), q(c["body"]),
            str(c["priceLakh"]), q(c.get("priceNote")), q(c["reg"]), q(c["location"]),
            arr(c.get("highlights", [])), q(c.get("listingUrl")), q(c.get("overview", "")),
            "null",                     # photo_stock: seeded cars keep their local assets
            "'{}'::text[]",             # photos_gallery: local gallery files, not storage
        ])
        rows.append(f"  ({vals})")
    body = ",\n".join(rows)
    return (f"insert into public.cars ({cols}) values\n{body}\n"
            "on conflict (id) do nothing;")


def main() -> None:
    out = None
    if "--out" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--out") + 1])
    sql = "-- seed generated from assets/data/inventory.json — idempotent, safe to re-run\n" \
          f"{brand_sql()}\n\n{cars_sql()}\n"
    if out:
        out.write_text(sql, encoding="utf-8")
        print(f"wrote {out} ({len(sql)} bytes)", file=sys.stderr)
    else:
        print(sql, end="")


if __name__ == "__main__":
    main()
