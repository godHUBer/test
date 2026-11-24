#!/usr/bin/env python3
"""Sohan Automobile — static site builder.

    python3 build.py            render the site
    python3 build.py --check    render to a temp dir, report problems, write nothing

Architecture
    src/*.src.html            the page markup — this is what you edit for copy
    assets/data/inventory.json  verified vehicle + company data (single source)
    assets/css/styles.css, assets/js/site.js   inlined into each page at build time

This script only injects blocks that must be generated from data:
    {{NAV}} {{FOOTER}}                       shared chrome, from the <body> data-* attrs
    {{CAR_CARDS:FEATURED}} {{CAR_CARDS:GRID}}  inventory cards
    {{FEATURED_CAR}} {{HERO_IMAGE}}            the lead vehicle
    {{INVENTORY_FILTERS}} {{INVENTORY_JSON_NOTE}}
    {{FLOOR_SHOTS}} {{CONTACT_GRID}} {{HOURS}}
    {{CAR.field}}                            per-vehicle tokens on the detail template
    {{PLACEHOLDER:label:note}}               a labelled image slot
    {{PH:field}}                             a labelled text placeholder

Nothing is invented. Where the dealership has published nothing, the page renders a
labelled placeholder (see PLACEHOLDERS) so the gap is visible instead of papered over.
An unrecognised token fails the build rather than shipping "{{TYPO}" to a customer.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
ASSETS = ROOT / "assets"
PAGES = {
    "index.src.html": "index.html",
    "inventory.src.html": "inventory.html",
    "sell.src.html": "sell-your-car.html",
    "about.src.html": "about.html",
    "showroom.src.html": "showroom.html",
    "contact.src.html": "contact.html",
    "legal.src.html": "legal.html",
}
DETAIL_TEMPLATE = "vehicle.src.html"
DETAIL_OUT = "car-{id}.html"

DATA = json.loads((ASSETS / "data/inventory.json").read_text(encoding="utf-8"))
BRAND, CARS = DATA["brand"], DATA["cars"]
CSS = (ASSETS / "css/styles.css").read_text(encoding="utf-8").strip()
JS = (ASSETS / "js/site.js").read_text(encoding="utf-8").strip()
DATAJS = (ASSETS / "js/data.js").read_text(encoding="utf-8").strip()

def check_btn_variants() -> None:
    """A renamed class leaves its rules behind in the stylesheet, and the stale ones are
    usually light-theme colours a dark site must not carry. Every button variant a template
    uses has to be defined in styles.css, and no variant may be defined and unused."""
    used = set()
    sources = [(SRC / n).read_text(encoding="utf-8") for n in list(PAGES) + [DETAIL_TEMPLATE]]
    sources.append(Path(__file__).read_text(encoding="utf-8"))   # the nav, cards and
    sources.append((ASSETS / "js/site.js").read_text(encoding="utf-8"))  # copy live in here
    for text in sources:
        for cls in re.findall(r'class="([^"]*)"', text):
            used |= {c for c in cls.split() if c.startswith("btn--")}
        used |= set(re.findall(r"btn--[a-z-]+", text))
    defined = {"btn--" + d for d in re.findall(r"\.btn--([a-z-]+)", CSS)}
    for label, bad in (("used but undefined", sorted(used - defined)),
                       ("defined but unused", sorted(defined - used))):
        if bad:
            raise SystemExit("styles.css: button variants " + label + ": " + ", ".join(bad))



def check_css(css: str) -> None:
    """A malformed stylesheet silently swallows every rule that follows the mistake,
    so the builder refuses to ship one: braces must balance and the tokens that carry
    the page geometry and the fluid type scale must actually exist in :root."""
    depth = 0
    for line_no, line in enumerate(css.split("\n"), start=1):
        depth += line.count("{") - line.count("}")
        if depth < 0:
            raise SystemExit("styles.css: unbalanced '}' near line %d" % line_no)
    if depth != 0:
        raise SystemExit("styles.css: %d unclosed '{' — some rules are being swallowed" % depth)
    absent = [t for t in ("--wrap", "--gutter", "--serif", "--sans", "--body", "--bg", "--surface",
                         "--ink", "--ink-2", "--brand", "--accent", "--line", "--s0", "--s3", "--s5",
                         "--pad", "--ease") if (t + ":") not in css]
    if absent:
        raise SystemExit("styles.css: :root is missing tokens " + ", ".join(absent))


check_css(CSS)
check_btn_variants()

FLOOR_COUNT = 30                                  # cars the dealer reports on its books
VERIFIED_PRETTY = date.fromisoformat(BRAND["verifiedOn"]).strftime("%d %B %Y")

PLACEHOLDERS = {
    "hours": "Opening hours to be confirmed by the dealership",
    "warranty": "The dealership does not publish a warranty programme",
    "inspection": "No standard inspection certificate is published — condition notes come from each listing",
    "finance": ("The dealership lists car finance and insurance among its services; lenders, rates and "
                "approval are set by the financier"),
    "valuation": "No instant online valuation is offered — price is discussed after the car has been seen",
    "testdrive": "Home test drives are flagged on individual listings; call to confirm for the car you want",
    "social": "No social media channel is published by the dealership",
    "team": "Team and staff photographs are not published — add them here with permission",
}
ARROW = ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'
         '<path d="M1 8h13M9.5 3l5 5-5 5"/></svg>')
CAM = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'
       '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7.6l1.3 2h2.6A1.5 1.5 0 0 1 21 8.5v10A1.5 1.5 0 0 1 19.5 20h-15'
       'A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.6"/></svg>')

# ---------------------------------------------------------------- primitives

def e(v) -> str:
    return (str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))

def price(p: float) -> str:
    return f"₹ {p:,.2f} Lakh"

def km(n: int) -> str:
    return f"{n:,} km"

def dims(path: Path) -> tuple[int, int]:
    """JPEG width/height straight from the SOF marker (no imaging dependency)."""
    try:
        with path.open("rb") as fh:
            fh.seek(2)
            b = fh.read(1)
            while b and b[0] not in (0xDA, 0xD9):
                while b and b[0] != 0xFF:
                    b = fh.read(1)
                while b == b"\xff":
                    b = fh.read(1)
                if b and 0xC0 <= b[0] <= 0xCF and b[0] not in (0xC4, 0xC8, 0xCC):
                    fh.read(3)
                    h = int.from_bytes(fh.read(2), "big")
                    w = int.from_bytes(fh.read(2), "big")
                    return w or 900, h or 675
                n = int.from_bytes(fh.read(2), "big")
                fh.seek(n - 2, 1)
                b = fh.read(1)
    except OSError:
        pass
    return 900, 675

def stock_path(car) -> Path:
    return ASSETS / "img" / "stock" / f"{car['id']}.jpg"

def gallery_paths(car) -> list[str]:
    out = [f"assets/img/gallery/{car['id']}-{n}.jpg"
           for n in (1, 2) if (ASSETS / "img" / "gallery" / f"{car['id']}-{n}.jpg").exists()]
    return out or [f"assets/img/stock/{car['id']}.jpg"]

def name(car, short=False) -> str:
    base = f"{car['make']} {car['model']}"
    return base if short else f"{car['year']} {base}"

def placeholder(label: str, note: str, dark: bool = False) -> str:
    cls = "ph ph--dark" if dark else "ph"
    return (f'<div class="{cls}" role="img" aria-label="{e(label)}: {e(note)}">'
            f'<div class="ph__in">{CAM}<b>{e(label)}</b><span>{e(note)}</span></div></div>')

# ------------------------------------------------------------------- chrome

NAV_ITEMS = [
    ("Home", "index.html", "home"),
    ("Browse cars", "inventory.html", "inventory"),
    ("Sell your car", "sell-your-car.html", "sell"),
    ("About us", "about.html", "about"),
    ("Our showroom", "showroom.html", "showroom"),
    ("Contact", "contact.html", "contact"),
]

def render_nav(current: str, overlay: bool) -> str:
    links = "\n".join(
        f'        <li><a href="{href}"{chr(32)}aria-current="page">{lab}</a></li>' if key == current
        else f'        <li><a href="{href}">{lab}</a></li>'
        for lab, href, key in NAV_ITEMS)
    sheet = "\n".join(
        f'      <li><a href="{href}"><span>{i + 1:02d}</span>{lab}</a></li>'
        for i, (lab, href, _k) in enumerate(NAV_ITEMS))
    logo = ('<img class="brand__logo" src="assets/img/logo.png" width="400" height="168" '
            'alt="Sohan Automobiles" decoding="async" fetchpriority="high">')
    return f"""<a class="skip" href="#main">Skip to content</a>
<nav class="nav{" nav--overlay" if overlay else ""}" aria-label="Main">
  <div class="wrap nav__inner">
    <a class="brand" href="index.html">{logo}</a>
    <div class="nav__links"><ul>
{links}
    </ul></div>
    <a class="btn btn--solid btn--sm nav__cta" href="inventory.html">Explore Inventory {ARROW}</a>
    <button class="nav__toggle" data-sheet-open aria-controls="sheet" aria-expanded="false"><i aria-hidden="true"></i>Menu</button>
  </div>
</nav>
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Site menu">
  <div class="sheet__top"><img class="sheet__logo" src="assets/img/logo.png" width="400" height="168"
    alt="Sohan Automobiles" decoding="async">
    <button class="sheet__close" data-sheet-close>Close</button></div>
  <ol>
{sheet}
  </ol>
  <div class="sheet__meta">
    <p class="sheet__meta-h">The showroom</p>
    <p>{e(BRAND["addressShort"])}, {e(BRAND["addressCity"])}<br>
      <a href="{e(BRAND["mapUrl"])}" target="_blank" rel="noopener">Open in Google Maps</a> ·
      <a href="mailto:{e(BRAND["email"])}">{e(BRAND["email"])}</a></p>
    <p class="sheet__meta-note"><span data-count-published>{len(CARS)}</span> cars published online · {FLOOR_COUNT} on the books ·
      data as listed {VERIFIED_PRETTY}</p>
  </div>
  <div class="sheet__foot">
    <a class="btn btn--bright" href="inventory.html">Explore Inventory {ARROW}</a>
    <a class="btn btn--line-dark" href="tel:{BRAND["phoneHref"]}">Call {e(BRAND["phoneDisplay"])}</a>
  </div>
</div>"""

def render_footer() -> str:
    return f"""<footer class="foot">
  <div class="wrap">
    <div class="foot__grid">
      <div>
        <img class="foot__logo" src="assets/img/logo.png" width="400" height="168"
          alt="Sohan Automobiles" loading="lazy" decoding="async">
        <p class="foot__tag">{e(BRAND["tagline"])}</p>
        <p class="foot__note">A multi-brand new and used car dealership in Kolkata since {e(BRAND["established"])} — sales,
          exchange, workshop service, finance and insurance, run from {e(BRAND["addressShort"])}.</p>
        <p class="small" style="color:#8E938D;margin-top:16px">{e(PLACEHOLDERS["social"])}.</p>
      </div>
      <div>
        <h4>The collection</h4>
        <ul>
          <li><a href="inventory.html">All published cars</a></li>
          <li><a href="inventory.html?body=SUV">SUVs</a></li>
          <li><a href="inventory.html?body=Sedan">Sedans</a></li>
          <li><a href="inventory.html?body=Hatchback">Hatchbacks</a></li>
          <li><a href="inventory.html?body=MUV">Seven-seaters</a></li>
          <li><a href="inventory.html?budget=0-5">Under ₹5 Lakh</a></li>
          <li><a href="inventory.html?fuel=Diesel">Diesel</a></li>
        </ul>
      </div>
      <div>
        <h4>Dealership</h4>
        <ul>
          <li><a href="about.html">Our story</a></li>
          <li><a href="showroom.html">Our showroom</a></li>
          <li><a href="sell-your-car.html">Sell your car</a></li>
          <li><a href="contact.html">Contact</a></li>
          <li><a href="contact.html#enquiry">Send an enquiry</a></li>
          <li><a href="legal.html">Privacy policy</a></li>
          <li><a href="legal.html#terms">Terms and conditions</a></li>
        </ul>
      </div>
      <div>
        <h4>The showroom</h4>
        <ul>
          <li class="contact-line"><b><a href="tel:{BRAND["phoneHref"]}">{e(BRAND["phoneDisplay"])}</a></b></li>
          <li class="contact-line"><b><a href="mailto:{e(BRAND["email"])}">{e(BRAND["email"])}</a></b></li>
          <li class="contact-line"><b><a href="{e(BRAND["mapUrl"])}" target="_blank" rel="noopener">{e(BRAND["addressShort"])}</a></b>
            <span>{e(BRAND["addressCity"])}</span></li>
          <li class="contact-line"><b>{e(PLACEHOLDERS["hours"])}</b></li>
        </ul>
      </div>
    </div>
    <div class="foot__bar">
      <span>© <span data-year-now>{date.today().year}</span> {e(BRAND["name"])}. Prices and availability as listed on {VERIFIED_PRETTY}.</span>
      <ul>
        <li><a href="legal.html">Privacy</a></li>
        <li><a href="legal.html#terms">Terms</a></li>
        <li><a href="legal.html#data">About our listing data</a></li>
      </ul>
    </div>
  </div>
</footer>"""

# ------------------------------------------------------------------- blocks

def render_card(car, idx=0, eager=False) -> str:
    p = f"assets/img/stock/{car['id']}.jpg"
    sm = f"assets/img/stock/{car['id']}-sm.jpg"
    w, h = dims(stock_path(car))
    flag = ""
    if "Less driven" in car.get("highlights", []):
        flag = '<span class="veh__flag veh__flag--bright">Less driven</span>'
    elif "Service history available" in car.get("highlights", []):
        flag = '<span class="veh__flag">Service history noted</span>'
    trans = e(car["transmission"]) if car["transmission"] else '<span class="to-confirm">Not stated</span>'
    return f"""<article class="veh" data-card data-reveal data-car-id="{e(car["id"])}" style="--d:{(idx % 3) * 90}ms"
   data-make="{e(car["make"])}" data-body="{e(car["body"])}" data-fuel="{e(car["fuel"])}"
   data-year="{car["year"]}" data-price="{car["priceLakh"]}" data-km="{car["km"]}"
   data-trans="{e((car["transmission"] or "unlisted").split(" ")[0])}">
  <div class="veh__media">
    {flag}
    <img src="{p}" srcset="{sm} 480w, {p} 900w" sizes="(min-width:1040px) 33vw, (min-width:680px) 50vw, 92vw"
      alt="{e(name(car))} {e(car["variant"])} — {e(car["body"])} listed at {e(BRAND["area"])}"
      width="{w}" height="{h}" loading="{'eager' if eager else 'lazy'}" decoding="async">
    <span class="veh__price tnum">{price(car["priceLakh"])}</span>
  </div>
  <div class="veh__body">
    <div>
      <h3 class="veh__title"><a href="car-{car["id"]}.html">{e(name(car))}</a></h3>
      <p class="veh__variant">{e(car["variant"])} · {e(car["reg"])} registration</p>
    </div>
    <dl class="veh__specs">
      <div><dt>Year</dt><dd class="tnum">{car["year"]}</dd></div>
      <div><dt>Odometer</dt><dd class="tnum">{km(car["km"])}</dd></div>
      <div><dt>Fuel</dt><dd>{e(car["fuel"])}</dd></div>
      <div><dt>Gearbox</dt><dd>{trans}</dd></div>
    </dl>
    <div class="veh__foot">
      <span class="veh__status">Available to view</span>
      <a class="tlink" href="car-{car["id"]}.html">View details {ARROW}</a>
    </div>
  </div>
</article>"""

def render_featured(car) -> str:
    p = f"assets/img/stock/{car['id']}.jpg"
    sm = f"assets/img/stock/{car['id']}-sm.jpg"
    w, h = dims(stock_path(car))
    rows = [
        ("Year of manufacture", f'<span class="tnum">{car["year"]}</span>'),
        ("Variant", e(car["variant"])),
        ("Kilometres driven", f'<span class="tnum">{km(car["km"])}</span>'),
        ("Fuel", e(car["fuel"])),
        ("Transmission", e(car["transmission"]) if car["transmission"]
         else '<span class="to-confirm">Not stated in the listing</span>'),
        ("Registration", f'{e(car["reg"])} · {e(BRAND["area"])}'),
        ("Availability", "Listed as available on " + VERIFIED_PRETTY),
    ]
    spec = "\n".join(f"      <div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in rows)
    tags = "\n".join(f'      <span class="tag">{e(t)}</span>' for t in car.get("highlights", []))
    return f"""<article class="veh-hero" data-car-id="{e(car["id"])}">
  <a class="veh-hero__media" href="car-{car["id"]}.html" aria-label="Open the listing for {e(name(car))}">
    <img src="{p}" srcset="{sm} 480w, {p} 900w" sizes="(min-width:1000px) 57vw, 92vw"
      alt="{e(name(car))} {e(car["variant"])} on the dealership forecourt" width="{w}" height="{h}"
      loading="eager" fetchpriority="high" decoding="async">
  </a>
  <div class="veh-hero__body">
    <p class="kicker">Newest on the floor</p>
    <h3 class="veh-hero__title">{e(name(car))}<br><em>{e(car["variant"])}</em></h3>
    <div class="price-lg tnum">{price(car["priceLakh"])}<small>Asking price, as listed on {VERIFIED_PRETTY}</small></div>
    <dl class="veh-hero__specs">
{spec}
    </dl>
    <div class="badge-row">
{tags}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px">
      <a class="btn btn--solid" href="car-{car["id"]}.html">View this car {ARROW}</a>
      <a class="btn btn--line" href="tel:{BRAND["phoneHref"]}">Call about it</a>
    </div>
  </div>
</article>"""

def render_filters() -> str:
    makes = sorted({c["make"] for c in CARS})
    bodies = sorted({c["body"] for c in CARS})
    fuels = sorted({c["fuel"] for c in CARS})
    years = sorted({c["year"] for c in CARS}, reverse=True)
    trans = sorted({c["transmission"].split(" ")[0] for c in CARS if c["transmission"]})
    options = lambda vals, labels={}: "\n      ".join(
        f'<option value="{e(v)}">{e(labels.get(v, v))}</option>' for v in vals)
    budget = [("0-3", "Under ₹3 Lakh"), ("3-5", "₹3 – 5 Lakh"), ("5-8", "₹5 – 8 Lakh"), ("8-99", "₹8 Lakh and above")]
    body_labels = {"SUV": "SUV", "Sedan": "Sedan", "Hatchback": "Hatchback", "MUV": "MUV / 7-seat"}
    chips = "\n      ".join(
        f'<button class="chip" type="button" data-value="{e(b)}" aria-pressed="false">{e(body_labels.get(b, b))}</button>'
        for b in bodies)
    return f"""<form class="filters" aria-label="Filter and sort the published collection">
  <div class="field">
    <label for="f-make">Manufacturer</label>
    <select id="f-make" data-filter="make">
      <option value="all">Any manufacturer</option>
      {options(makes)}
    </select>
  </div>
  <div class="field">
    <label for="f-budget">Budget</label>
    <select id="f-budget" data-filter="budget">
      <option value="all">Any budget</option>
      {options([v for v, _ in budget], dict(budget))}
    </select>
  </div>
  <div class="field">
    <label for="f-year">Registered from</label>
    <select id="f-year" data-filter="year">
      <option value="all">Any year</option>
      {options(years)}
    </select>
  </div>
  <div class="field">
    <label for="f-fuel">Fuel</label>
    <select id="f-fuel" data-filter="fuel">
      <option value="all">Any fuel</option>
      {options(fuels)}
    </select>
  </div>
  <div class="field">
    <label for="f-trans">Transmission</label>
    <select id="f-trans" data-filter="trans">
      <option value="all">Any gearbox</option>
      {options(trans, {"Automatic": "Automatic", "Manual": "Manual", "iMT": "Manual (iMT)"})}
    </select>
  </div>
  <div class="field">
    <label for="f-sort">Sort by</label>
    <select id="f-sort" data-sort>
      <option value="featured">Featured order</option>
      <option value="price">Price — low to high</option>
      <option value="km">Odometer — low to high</option>
      <option value="year">Year — newest first</option>
    </select>
  </div>
  <div class="field form__full">
    <span class="legend" id="f-body">Body type</span>
    <div class="chips" role="group" aria-labelledby="f-body">
      <button class="chip" type="button" data-value="all" aria-pressed="true">All body types</button>
      {chips}
    </div>
  </div>
</form>"""

def render_shots(cars) -> str:
    return "\n    ".join(
        f'''<figure class="shot{" shot--wide" if i == 0 else ""}">
      <img src="assets/img/stock/{c["id"]}.jpg" alt="{e(name(c, True))} on the forecourt at {e(BRAND["area"])}"
           width="900" height="675" loading="lazy" decoding="async">
      <figcaption>{e(name(c, True))} · <span class="tnum">{km(c["km"])}</span> · {price(c["priceLakh"])}</figcaption>
    </figure>''' for i, c in enumerate(cars))

def render_contact_grid() -> str:
    return f"""<dl class="contact-grid">
  <div><dt>Telephone</dt><dd><a href="tel:{BRAND["phoneHref"]}">{e(BRAND["phoneDisplay"])}</a>
    <small>Fastest route to the floor — ask for the car by name.</small></dd></div>
  <div><dt>Email</dt><dd><a href="mailto:{e(BRAND["email"])}">{e(BRAND["email"])}</a>
    <small>Replies on working days; send photographs when selling.</small></dd></div>
  <div><dt>Showroom</dt><dd><a href="{e(BRAND["mapUrl"])}" target="_blank" rel="noopener">{e(BRAND["addressShort"])}</a>
    <small>{e(BRAND["addressCity"])} · also listed as {e(BRAND["area"])}</small></dd></div>
  <div><dt>Hours</dt><dd>{e(PLACEHOLDERS["hours"])}
    <small>Add the confirmed times to this site — the dealership has not published them.</small></dd></div>
  <div><dt>Services</dt><dd>{e(" · ".join(BRAND["services"]))}
    <small>As listed on the dealership's own About page.</small></dd></div>
  <div><dt>Established</dt><dd>{e(BRAND["established"])}
    <small>Under {e(BRAND["ledBy"])}.</small></dd></div>
</dl>"""

def jsonld(car) -> str:
    d = {
        "@context": "https://schema.org", "@type": "Car",
        "name": f"{name(car)} {car['variant']}",
        "brand": {"@type": "Brand", "name": car["make"]},
        "model": car["model"], "vehicleModelDate": str(car["year"]),
        "vehicleSpecificTransmission": {"@type": "PropertyValue", "name": "Transmission", "value": car["transmission"] or "Not stated"},
        "fuelType": car["fuel"], "odometer": f"{car['km']} KM",
        "vehicleIdentificationNumber": None,
        "offers": {"@type": "Offer", "price": f"{car['priceLakh'] * 100000:.0f}", "priceCurrency": "INR",
                   "availability": "https://schema.org/InStock",
                   "availableAtOrFrom": {"@type": "Place", "name": BRAND["name"], "address": {
                       "@type": "PostalAddress", "streetAddress": BRAND["addressShort"],
                       "addressLocality": "Kolkata", "postalCode": "700010", "addressRegion": "WB",
                       "addressCountry": "IN"}}},
        "image": [f"{stock_path(car).name}"], "description": car["overview"],
    }
    d = {k: v for k, v in d.items() if v is not None}
    return "<script type=\"application/ld+json\">\n" + json.dumps(d, ensure_ascii=False, indent=1) + "\n  </script>"

# ---------------------------------------------------------- detail template

def car_tokens(car) -> dict:
    sim = [c for c in CARS if c["id"] != car["id"] and (c["body"] == car["body"]
           or abs(c["priceLakh"] - car["priceLakh"]) <= 2.0)]
    known = [car["year"], car["variant"], car["km"], car["fuel"], car["transmission"], car["reg"], car["priceLakh"]]
    filled = sum(1 for x in known if x)
    shots = render_shots(sim[:4])
    gal = gallery_paths(car)
    w, h = dims(stock_path(car))
    def frame_attrs(i: int) -> str:
        # a helper keeps backslashes out of the f-string expression (Python 3.11 compatible)
        return 'loading="eager" fetchpriority="high"' if i == 0 else 'loading="lazy"'

    frames = "\n".join(
        f'      <img data-frame src="{g}" alt="{e(name(car))} {e(car["variant"])}, view {i + 1} of {len(gal)} at the showroom" '
        f'width="{max(w, 1400)}" height="{max(h, 1050)}" {frame_attrs(i)} decoding="async">'
        for i, g in enumerate(gal))
    thumbs = "\n".join(
        f'      <button type="button" data-thumb aria-current="{"true" if i == 0 else "false"}" '
        f'aria-label="Show photograph {i + 1}"><img src="{g}" alt=""></button>' for i, g in enumerate(gal))
    spec_rows = [
        ("Year of manufacture", f'<span class="tnum">{car["year"]}</span>', True),
        ("Variant", e(car["variant"]), True),
        ("Kilometres driven", f'<span class="tnum">{km(car["km"])}</span>', True),
        ("Fuel", e(car["fuel"]), True),
        ("Transmission", e(car["transmission"]) if car["transmission"]
         else '<span class="to-confirm">Not stated in the listing — ask the showroom</span>', bool(car["transmission"])),
        ("Body type", e(car["body"]), True),
        ("Registration", f'{e(car["reg"])}', True),
        ("Location", e(car["location"]), True),
    ]
    dl = "\n      ".join(
        f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v, _ok in spec_rows)
    tags = "\n      ".join(f'<span class="tag">{e(t)}</span>' for t in car.get("highlights", []))
    price_note = car.get("priceNote")
    return {
        "CAR_TITLE": e(f"{name(car)} {car['variant']} | {BRAND['name']}"),
        "CAR_DESC": e(f"{name(car)} {car['variant']} — {km(car['km'])}, {car['fuel']}, "
                      f"{price(car['priceLakh'])}. Kolkata pre-owned listing from {BRAND['name']}, {BRAND['addressShort']}."),
        "CANONICAL": f"car-{car['id']}.html",
        "CAR_NAME": e(name(car)),
        "CAR_NAME_SHORT": e(name(car, True)),
        "CAR_VARIANT": e(car["variant"]),
        "CAR_PRICE": price(car["priceLakh"]),
        "CAR_PRICE_NOTE": (f'<p class="small dim" style="margin:8px 0 0">{e(price_note)}</p>' if price_note else ""),
        "CAR_KM": km(car["km"]),
        "CAR_FUEL": e(car["fuel"]),
        "CAR_YEAR": str(car["year"]),
        "CAR_BODY": e(car["body"]),
        "CAR_REG": e(car["reg"]),
        "CAR_LOCATION": e(car["location"]),
        "CAR_SPEC_ROWS": dl,
        "CAR_TAGS": tags,
        "CAR_OVERVIEW": e(car["overview"]),
        "CAR_FRAMES": frames,
        "CAR_THUMBS": thumbs,
        "CAR_GALLERY_COUNT": f"1 / {len(gal)}",
        "CAR_LIGHTBOX": gal[0],
        "CAR_FRAMES_COUNT": f"{len(gal)}",
        "CAR_SIMILAR": shots or '<p class="dim">No comparable car is published right now.</p>',
        "CAR_ID": car["id"],
        "CAR_DATA_CONTEXT": f'Enquiry about: {name(car)} {car["variant"]} ({price(car["priceLakh"])}) — id {car["id"]}',
        "CAR_COMPLETE": f"{filled} of {len(known)}",
        "CAR_IMG_W": str(w), "CAR_IMG_H": str(h),
        "CAR_LISTING_URL": e(car["listingUrl"]),
        "JSONLD": jsonld(car),
        "CAR_HIGHLIGHT_NOTE": (
            "These lines are copied from the dealership's published listing. They are the seller's description, "
            "not an independent inspection report." if car.get("highlights") else
            "The listing carries no condition highlights for this car — the condition notes on this page are limited "
            "to the specification that was published."),
    }

# ------------------------------------------------------------------ render

TOKEN = re.compile(r"\{\{([A-Z0-9_.:]+)\}\}")

def inject(html: str, ctx: dict, origin: str) -> tuple[str, list[str]]:
    missing = []
    def sub(m):
        key = m.group(1)
        if key in ctx:
            return ctx[key]
        missing.append(key)
        return m.group(0)
    out = TOKEN.sub(sub, html)
    if missing:
        raise SystemExit(f"{origin}: no value for token(s): " + ", ".join(sorted(set(missing))))
    return out, []

def special_tokens(html: str, ctx: dict) -> str:
    """{{PLACEHOLDER:Label|note[:dark]}}, {{PH:key}}, {{NAV}}, {{FOOTER}}, {{CAR_CARDS:...}}"""
    def ph(m):
        inner = m.group(1)
        dark = inner.endswith(":dark")
        if dark:
            inner = inner[:-len(":dark")]
        label, _sep, note = inner.partition("|")
        return placeholder(label.strip(), note.strip() or "Not published by the dealership", dark=dark)
    html = re.sub(r"\{\{PLACEHOLDER:([^}]+)\}\}", ph, html)
    html = re.sub(r"\{\{PH:([a-z]+)\}\}", lambda m: e(PLACEHOLDERS[m.group(1)]), html)

    def cards(m):
        which = m.group(1)
        feat = next((c for c in CARS if c.get("featured")), max(CARS, key=lambda c: (c["year"], -c["km"])))
        if which == "FEATURED":
            return render_featured(feat)
        if which == "GRID":
            grid = [c for c in CARS if c["id"] != feat["id"]][:6]
            return "\n      ".join(render_card(c, i) for i, c in enumerate(grid))
        if which == "ALL":
            return "\n      ".join(render_card(c, i, eager=i < 3) for i, c in enumerate(CARS))
        if which.startswith("SIM:"):
            ids = m.group(1).split(":")[1].split(",")
            picked = [next(c for c in CARS if c["id"] == i) for i in ids]
            return "\n      ".join(render_card(c, i) for i, c in enumerate(picked))
        raise SystemExit(f"unknown CAR_CARDS block: {which}")
    html = re.sub(r"\{\{CAR_CARDS:([^}]+)\}\}", cards, html)

    def shots(m):
        arg = m.group(1)
        if arg == "FLOOR":
            return render_shots([CARS[0], CARS[2], CARS[7], CARS[9]])
        if arg == "STORY":
            return render_shots([CARS[5], CARS[1], CARS[10]])
        picked = [next(c for c in CARS if c["id"] == i) for i in arg.split(",")]
        return render_shots(picked)
    html = re.sub(r"\{\{SHOTS:([^}]+)\}\}", shots, html)

    def img(m):
        car = next(c for c in CARS if c["id"] == m.group(1))
        w, h = dims(stock_path(car))
        big = gallery_paths(car)[0]
        return (f'<img src="{big}" alt="{e(name(car))} {e(car["variant"])}, photographed at {e(BRAND["area"])}" '
                f'width="1400" height="1050" loading="lazy" decoding="async">')
    html = re.sub(r"\{\{IMG:([a-z0-9-]+)\}\}", img, html)

    def options(m):
        sel = m.group(1) if m.group(1) else ""
        out = ['<option value="">Which car? (optional)</option>'] if sel == "optional" else []
        for c in sorted(CARS, key=lambda c: (c["make"], c["year"])):
            out.append(f'<option value="{e(name(c) + " " + c["variant"])}" data-car-id="{e(c["id"])}">{e(name(c))} — {e(c["variant"])} '
                       f'· {price(c["priceLakh"])}</option>')
        return "\n      ".join(out)
    html = re.sub(r"\{\{CAR_OPTIONS(?::?([a-z]+))?\}\}", lambda m: options(m), html)

    html = re.sub(r"\{\{HERO_IMAGE\}\}", lambda m: hero_image(), html)
    html = html.replace("{{FOOTER}}", render_footer())
    return html

def hero_image() -> str:
    img = ASSETS / "img" / "hero-vehicle.jpg"
    w, h = dims(img)
    lead = CARS[4]
    return (f'<img src="assets/img/hero-vehicle.jpg" width="{w}" height="{h}" '
            f'alt="{e(name(lead))} {e(lead["variant"])}, photographed on the dealership forecourt" '
            f'fetchpriority="high" decoding="async">')

def render(src_name: str, out_name: str, ctx: dict, destdir: Path) -> str:
    raw = (SRC / src_name).read_text(encoding="utf-8")
    # nav needs the page context, so resolve it before generic tokens
    page = re.search(r'<body[^>]*data-page="([^"]+)"', raw)
    overlay = bool(re.search(r'data-nav="overlay"', raw))
    raw = raw.replace("{{NAV}}", render_nav(page.group(1) if page else "", overlay))
    body = special_tokens(raw, ctx)
    body = body.replace("{{STYLES}}", f"<style>\n{CSS}\n</style>")
    body = body.replace("{{SCRIPT}}", f"<script>\n{JS}\n</script>")
    body = body.replace("{{DATA}}", f"<script>\n{DATAJS}\n</script>")
    body, _ = inject(body, ctx, src_name)
    # the inlined stylesheet legitimately holds SVG data URIs, so check only the markup
    head = body.split("<style>")[0].split("</head>")[0]
    if "<rect" in head or "</svg>" in head:
        raise SystemExit(f"{src_name}: stray markup inside <head> — check the icon/meta links")
    if head.count('<link rel="icon"') != 3 or 'apple-touch-icon' not in head:
        raise SystemExit(f"{src_name}: expected three favicon links plus an apple-touch-icon in <head>")
    leftover = TOKEN.findall(body)
    if leftover:
        raise SystemExit(f"{src_name}: unresolved token(s) {sorted(set(leftover))}")
    if "{{" in body:
        raise SystemExit(f"{src_name}: stray braces left in output")
    (destdir / out_name).write_text(body, encoding="utf-8")
    return body

def build(destdir: Path) -> list[tuple[str, int]]:
    made = []
    base_ctx = {
        "BRAND": e(BRAND["name"]),
        "PHONE": e(BRAND["phoneDisplay"]),
        "PHONE_HREF": BRAND["phoneHref"],
        "EMAIL": e(BRAND["email"]),
        "ADDRESS": e(BRAND["addressShort"]),
        "ADDRESS_CITY": e(BRAND["addressCity"]),
        "AREA": e(BRAND["area"]),
        "MAP_URL": e(BRAND["mapUrl"]),
        "YEAR": BRAND["established"],
        "LEAD": e(BRAND["ledBy"]),
        "VERIFIED": VERIFIED_PRETTY,
        "PUBLISHED": str(len(CARS)),
        "FLOOR": str(FLOOR_COUNT),
        "CONTACT_GRID": render_contact_grid(),
        "FILTERS": render_filters(),
        "PRICE_MIN": price(min(c["priceLakh"] for c in CARS)),
        "PRICE_MAX": price(max(c["priceLakh"] for c in CARS)),
        "MAKES": e(", ".join(sorted({c["make"] for c in CARS}))),
        "SERVICE_LIST": e(" · ".join(BRAND["services"])),
        "SOURCE_INVENTORY": e(BRAND["sourceInventory"]),
        "SOURCE_SITE": e(BRAND["sourceSite"]),
    }
    for src_name, out_name in PAGES.items():
        ctx = dict(base_ctx)
        head = (SRC / src_name).read_text(encoding="utf-8")
        for key in ("TITLE", "DESCRIPTION", "CANONICAL", "OG_TITLE"):
            if f"{{{{{key}}}}}" in head:
                defaults = {
                    "TITLE": {"index.src.html": f"{BRAND['name']} — pre-owned cars in Kolkata | {BRAND['tagline']}",
                              }.get(src_name, f"{BRAND['name']}"),
                    "DESCRIPTION": "Pre-owned cars in Kolkata, published with the details the dealership has stated.",
                    "CANONICAL": out_name,
                    "OG_TITLE": BRAND["name"],
                }
                ctx.setdefault(key, e(defaults[key]))
        html = render(src_name, out_name, ctx, destdir)
        made.append((out_name, len(html.encode())))
    for car in CARS:
        ctx = dict(base_ctx)
        ctx.update(car_tokens(car))
        html = render(DETAIL_TEMPLATE, DETAIL_OUT.format(id=car["id"]), ctx, destdir)
        made.append((DETAIL_OUT.format(id=car["id"]), len(html.encode())))
    return made

def main() -> None:
    check = "--check" in sys.argv
    destdir = Path("/tmp/sohan-build") if check else ROOT
    destdir.mkdir(parents=True, exist_ok=True)
    # missing image guard — the build should fail loudly, not ship a broken <img>
    for car in CARS:
        if not stock_path(car).exists():
            raise SystemExit(f"missing stock photograph for {car['id']}: {stock_path(car)}")
    made = build(destdir)
    total = sum(n for _n, n in made) / 1024
    print(f"{len(made)} pages written to {destdir} — {total:,.0f} KB html, {len(CSS)/1024:.0f} KB css and "
          f"{len(JS)/1024:.0f} KB js inlined into each")
    biggest = max(made, key=lambda t: t[1])
    print(f"largest page: {biggest[0]} at {biggest[1]/1024:.0f} KB")
    if check:
        print("(--check: nothing in the site folder was modified)")

if __name__ == "__main__":
    main()
