#!/usr/bin/env python3
"""Sync the Supabase published inventory back into assets/data/inventory.json.

Pulls `cars` and `brand_settings` from the project's REST API — the same public
publishable-key endpoint the site's runtime layer uses, so this script needs no
secrets and can run anywhere. Row-level security shapes what it sees:

  available + reserved + sold  → synced into the JSON (sold cars keep their
                                 detail pages for the "sold" notice; reserved
                                 cards are badged live by the runtime layer)
  hidden                       → NOT visible through this endpoint, so a hidden
                                 car leaves the JSON at the next sync and its
                                 built page disappears at the next rebuild.
                                 That is the designed behaviour: hidden means
                                 invisible everywhere until restored.

Rows added through the admin panel are written into the JSON with their Storage
photo paths (`photoStock`, `photosGallery`); build.py renders those from the
Storage bucket, so panel-added cars get real detail pages at the next rebuild.

Fields the database deliberately does not hold (established, ledBy,
sourceInventory, sourceSite, social) are preserved from the existing JSON.

Usage:
    python3 scripts/sync_db.py            # sync against the default project
    python3 scripts/sync_db.py --ref REF --key KEY
Then rebuild the static pages:
    python3 build.py
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INV = ROOT / "assets/data/inventory.json"

DEFAULT_REF = "vxlxoiycolfojcnhnzfr"
DEFAULT_KEY = "sb_publishable_7OTbCZGA4jhjP4sL6KAg0A_fjsfo9js"

CAR_SELECT = ("id,status,sort_order,featured,year,make,model,variant,km,fuel,"
              "transmission,body,price_lakh,price_note,reg,location,highlights,"
              "listing_url,overview,photo_stock,photos_gallery")


def get(base: str, key: str, path: str, params: dict):
    url = f"{base}/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)


def car_json(row: dict) -> dict:
    """DB row → the camelCase schema inventory.json has always used."""
    d = {
        "id": row["id"],
        "year": row["year"],
        "make": row["make"],
        "model": row["model"],
        "variant": row["variant"],
        "km": row["km"],
        "fuel": row["fuel"],
        "transmission": row["transmission"],
        "body": row["body"],
        "priceLakh": float(row["price_lakh"]),
        "priceNote": row["price_note"],
        "reg": row["reg"],
        "location": row["location"],
        "highlights": row["highlights"] or [],
        "listingUrl": row["listing_url"],
        "overview": row["overview"] or "",
    }
    if row.get("featured"):
        d["featured"] = True
    if row["status"] != "available":
        d["status"] = row["status"]
    if row.get("photo_stock"):
        d["photoStock"] = row["photo_stock"]
    if row.get("photos_gallery"):
        d["photosGallery"] = row["photos_gallery"]
    return d


def transform(rows: list, brand_row: dict, existing: dict) -> dict:
    """DB rows + current JSON → the new inventory.json content (pure function)."""
    b = brand_row
    brand_out = dict(existing.get("brand", {}))
    brand_out.update({
        "name": b.get("name") or brand_out.get("name"),
        "tagline": b.get("tagline") or brand_out.get("tagline"),
        "phoneDisplay": b.get("phone_display"),
        "phoneHref": b.get("phone_href"),
        "email": b.get("email"),
        "addressShort": b.get("address_short"),
        "addressCity": b.get("address_city"),
        "area": b.get("area"),
        "mapUrl": b.get("map_url"),
        "services": b.get("services") or [],
        "hours": b.get("hours"),
        "verifiedOn": b.get("verified_on") or brand_out.get("verifiedOn"),
    })
    return {"brand": brand_out, "cars": [car_json(r) for r in rows]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default=DEFAULT_REF)
    ap.add_argument("--key", default=DEFAULT_KEY)
    args = ap.parse_args()
    base = f"https://{args.ref}.supabase.co/rest/v1"

    rows = get(base, args.key, "cars", {"select": CAR_SELECT, "order": "sort_order.asc"})
    brand_rows = get(base, args.key, "brand_settings", {"id": "eq.1", "select": "*"})
    if not brand_rows:
        print("brand_settings row 1 missing — run the seeder first", file=sys.stderr)
        return 1

    existing = json.loads(INV.read_text(encoding="utf-8"))
    out = transform(rows, brand_rows[0], existing)
    text = json.dumps(out, indent=2, ensure_ascii=True) + "\n"
    if text == INV.read_text(encoding="utf-8"):
        print(f"sync: no changes — {len(rows)} cars, brand row already mirrored")
        return 0
    INV.write_text(text, encoding="utf-8")
    print(f"sync: wrote {INV} — {len(rows)} cars "
          f"({sum(1 for r in rows if r['status'] != 'available')} non-available), "
          f"brand overlay applied. Now run: python3 build.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
