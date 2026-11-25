// Auto-generated from the legacy editorial templates by scripts/build-editorial.mjs.
// Do not edit by hand; the content is the reviewed public copy. Internal links are
// already rewritten to Next.js routes and asset paths are root-relative.
export const editorialTemplates: Record<string, string> = {
  "/": `<main id="main">

<!-- ============================================================ HERO ==== -->
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media">{{HERO_IMAGE}}</div>
  <div class="hero__scrim"></div>
  <div class="wrap hero__inner">
    <p class="kicker" style="color:var(--accent-soft)">The art of choosing well</p>
    <h1 id="hero-title">Find the Car That<br><em>Moves You.</em></h1>
    <p class="hero__body">Explore thoughtfully selected pre-owned automobiles, with the details and support you need to
      make a confident decision.</p>
    <div class="hero__actions">
      <a class="btn btn--bright" href="/inventory">Explore Inventory
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></a>
      <a class="tlink hero__story" href="/about">Discover Our Story</a>
    </div>
    <p class="hero__credit">In stock at the showroom · 2023 Vit&#8217;Brezza ZXi · 18,859 km</p>
    <div class="hero__foot tnum">
      <span><b data-countup>{{PUBLISHED}}</b> cars published online</span><span class="sep">/</span>
      <span><b data-countup>{{FLOOR}}</b> on the books</span><span class="sep">/</span>
      <span>Since <b data-countup="plain">{{YEAR}}</b></span><span class="sep">/</span>
      <span>{{AREA}}</span><span class="sep">/</span>
      <span><a href="tel:{{PHONE_HREF}}">{{PHONE}}</a></span>
    </div>
  </div>
</section>

<!-- ======================================================= APPROACH ==== -->
<section class="band--sm approach" aria-labelledby="approach-h">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">How this dealership works</p>
        <h2 id="approach-h">Quality, transparency, and a<br>straight answer.</h2>
      </div>
      <div class="head__aside">
        <p class="small dim approach-note">We are not a marketplace and we do not certify cars we have not looked at. What
          follows is the specification the dealership has actually published for each car — with the gaps left visible.</p>
      </div>
    </div>
  </div>
  <div class="wrap">
    <div class="pillars">
      <div class="pillar" data-reveal><span class="pillar__no">01 · Selection</span>
        <h3>Cars are taken in one at a time</h3>
        <p>Multi-brand, so the floor follows what is genuinely well kept rather than what one manufacturer wants moved.
          Ask what the team liked and disliked about any car — that question is usually more useful than a badge.</p></div>
      <div class="pillar" data-reveal style="--d:80ms"><span class="pillar__no">02 · Transparency</span>
        <h3>What the listing states, and what it does not</h3>
        <p>Year, variant, odometer, fuel and registration city are published for every car on this site. Where a listing
          is silent — a gearbox type, say — the page reads <em>not stated</em> rather than guessing on your behalf.</p></div>
      <div class="pillar" data-reveal style="--d:160ms"><span class="pillar__no">03 · Assistance</span>
        <h3>One contact, enquiry to handover</h3>
        <p>The same desk arranges the viewing, the paperwork, the exchange of your old car and the introductions for
          finance or insurance. Repairs and servicing stay with the same team afterwards.</p></div>
      <div class="pillar" data-reveal style="--d:240ms"><span class="pillar__no">04 · Viewing</span>
        <h3>See it in Kolkata before you decide</h3>
        <p>Photographs here are taken at the showroom, not in a studio. Book a slot, walk around it, start it cold,
          and drive it on roads you actually use.</p></div>
    </div>
  </div>
</section>

<!-- ==================================================== COLLECTION ===== -->
<section class="band band--surface" id="collection" aria-labelledby="collection-h">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">The collection</p>
        <h2 id="collection-h">Considered Choices.<br>Exceptional Cars.</h2>
      </div>
      <div class="head__aside">
        <p class="lede" style="max-width:40ch">Explore our latest arrivals and discover the vehicles currently available
          in our collection.</p>
        <a class="tlink" href="/inventory">All {{PUBLISHED}} published cars
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></a>
      </div>
    </div>

    <div data-reveal style="margin-bottom:clamp(34px,4.4vw,62px)">{{CAR_CARDS:FEATURED}}</div>

    <div class="veh-grid veh-grid--3">
      {{CAR_CARDS:GRID}}
    </div>

    <div class="collection-foot">
      <dl class="mini-facts tnum">
        <div><dt>Published here</dt><dd>{{PUBLISHED}} cars</dd></div>
        <div><dt>On the books</dt><dd>{{FLOOR}} cars</dd></div>
        <div><dt>Price range</dt><dd>{{PRICE_MIN}} – {{PRICE_MAX}}</dd></div>
        <div><dt>Brands</dt><dd>{{MAKES}}</dd></div>
        <div><dt>Data as listed</dt><dd>{{VERIFIED}}</dd></div>
      </dl>
      <div class="notes">
        <h4>Before you travel</h4>
        <p style="margin:0">Pre-owned stock is single-unit and moves week to week; a car shown here may already be
          reserved or repriced. Phone <a href="tel:{{PHONE_HREF}}">{{PHONE}}</a> to confirm the car and the figure —
          and expect a car that has sat on the floor for a while to be discussable.</p>
      </div>
    </div>
  </div>
</section>

<!-- ======================================================== SELLING ==== -->
<section class="band" id="sell" aria-labelledby="sell-h">
  <div class="wrap grid g-7-5">
    <div>
      <p class="kicker">Sell or exchange</p>
      <h2 id="sell-h">Ready for your next car?<br>Let&#8217;s talk about this one.</h2>
      <p class="lede">Looking to sell your current vehicle? Share a few details with our team and let us discuss the
        next steps. Exchange against a car on the floor is one of the dealership&#8217;s published services, so a swap
        is as easy to arrange as a cash sale.</p>
      <ol class="steps">
        <li><span>01</span><div><b>Send the basics.</b> Manufacturer, model, year, odometer, location, and anything the
          photographs will not show — service history, insurance validity, modifications.</div></li>
        <li><span>02</span><div><b>We look at the car.</b> Inspection at {{ADDRESS}} or at your address inside Kolkata.</div></li>
        <li><span>03</span><div><b>Settle, or swap.</b> A figure after inspection, then paperwork, RC transfer and payment
          handled from the same desk.</div></li>
      </ol>
      <div class="btn-row">
        <a class="btn btn--solid" href="/sell-your-car">Submit Vehicle Details
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></a>
        <a class="btn btn--line" href="tel:{{PHONE_HREF}}">Call {{PHONE}}</a>
      </div>
    </div>
    <div class="stack-lg">
      <div class="shot-stack">
        {{SHOTS:ertiga-2014,taigun-2022}}
      </div>
      <div class="notes">
        <h4>No instant valuation on this site</h4>
        <p style="margin:0">{{PH:valuation}}. A figure produced from a form alone is a guess, and guessing is how sellers
          end up annoyed. We would rather look at the car and give you one honest number.</p>
      </div>
    </div>
  </div>
</section>

<!-- ========================================================== STORY ==== -->
<section class="band band--dark dark" aria-labelledby="story-h">
  <div class="wrap grid g-7-5">
    <div>
      <p class="kicker">Our story</p>
      <h2 id="story-h">More than a transaction.<br>A better way to <em>choose</em>.</h2>
      <p class="lede">Sohan Automobile was established in {{YEAR}} under {{LEAD}}, and describes itself as West Bengal&#8217;s
        integrated multi-brand auto solution network: new and used car sales, used car exchange, repairs, servicing,
        finance and insurance, from one address.</p>
      <p class="lede" style="margin-top:-4px">The stated philosophy is unglamorous and correct — transparency, delivery on
        time, getting it right the first time. This website follows it: listings carry only what the dealership has
        published, and what has not been published is marked as such.</p>
      <div class="btn-row">
        <a class="btn btn--bright" href="/showroom">Visit Our Showroom
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></a>
        <a class="btn btn--line-dark" href="/about">Read the full story</a>
      </div>
      <dl class="story-facts tnum">
        <div><dt>Founded</dt><dd>{{YEAR}}, Kolkata</dd></div>
        <div><dt>Services</dt><dd>{{SERVICE_LIST}}</dd></div>
        <div><dt>Showroom</dt><dd>{{ADDRESS}}, {{ADDRESS_CITY}}</dd></div>
      </dl>
    </div>
    <div class="story-media">
      {{SHOTS:STORY}}
      {{PLACEHOLDER:Team at the counter|Staff photographs are not published — add them with permission:dark}}
    </div>
  </div>
</section>

<!-- ==================================================== WHY / SPLIT ==== -->
<section class="why-split" aria-labelledby="why-h">
  <div class="why-split__media">
    {{IMG:creta-2018}}
    <span class="why-split__cap">A 2018 Creta on the forecourt · 54,929 km · listed at ₹ 6.00 Lakh</span>
  </div>
  <div class="why-split__text">
    <p class="kicker">Why choose us</p>
    <h2 id="why-h">Five reasons the floor<br>stays small.</h2>
    <div class="why-list">
      <div><span>01</span><div><h4>Curated selection</h4><p>Cars are bought in individually by the people who will resell
        them, so the collection stays small enough to know each one.</p></div></div>
      <div><span>02</span><div><h4>Clear vehicle information</h4><p>Specifications come from the published listing.
        Gaps are labelled, not smoothed over.</p></div></div>
      <div><span>03</span><div><h4>Personalised assistance</h4><p>One contact for viewing, paperwork, exchange and finance
        introductions.</p></div></div>
      <div><span>04</span><div><h4>Showroom viewing</h4><p>Every car can be inspected at {{AREA}}; a home test drive is
        offered on the listings that say so.</p></div></div>
      <div><span>05</span><div><h4>Support through the purchase</h4><p>Workshop servicing, repairs and transfer help come
        from the same team that sold you the car.</p></div></div>
    </div>
  </div>
</section>

<!-- =============================================== EXPERIENCES / FLOOR == -->
<section class="band" aria-labelledby="floor-h">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">Customer experiences</p>
        <h2 id="floor-h">We will not invent<br>a review.</h2>
      </div>
      <div class="head__aside">
        <p class="small dim" style="max-width:42ch;margin:0">The dealership has published no verified testimonials, so this
          space shows the cars and the forecourt instead. Ask at the counter and we will put you in touch with a past buyer
          who has agreed to talk.</p>
        <a class="tlink" href="mailto:{{EMAIL}}?subject=Buyer%20reference%20request">Request a buyer reference</a>
      </div>
    </div>
    <div class="shot-grid">
      {{SHOTS:FLOOR}}
    </div>
    <figure class="statement">
      <blockquote>&#8220;We introduced ourselves as car dealers who have established their presence in the automobile market
        with a reputation of success.&#8221;</blockquote>
      <figcaption>From the dealership&#8217;s own About page</figcaption>
    </figure>
  </div>
</section>

<!-- ============================================================ FAQ ==== -->
<section class="band band--tint" id="faq" aria-labelledby="faq-h">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">Before you call</p>
        <h2 id="faq-h">Seven questions,<br>answered honestly.</h2>
      </div>
      <div class="head__aside">
        <p class="small dim" style="max-width:36ch;margin:0">Where the dealership has published nothing on a subject, the
          answer says so instead of promising.</p>
      </div>
    </div>
    <div class="faq">
      <details><summary><span class="no">01</span>How can I browse the cars you have?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p>The <a href="/inventory">collection page</a> holds {{PUBLISHED}} of the {{FLOOR}} cars
          the dealership keeps on its books — those are the ones published online with photographs and specifications. The
          balance is sold directly from the floor. Call <a href="tel:{{PHONE_HREF}}">{{PHONE}}</a> and ask for the full list;
          it takes a minute and it is current in a way a website cannot always be.</p></div></details>
      <details><summary><span class="no">02</span>Can I schedule a showroom visit?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p>Yes — phone ahead, name the car, and agree a time. {{PH:hours}}. Several listings carry a
          &#8220;free home test drive&#8221; note, meaning the team will bring the car to you inside Kolkata; {{PH:testdrive}}.</p></div></details>
      <details><summary><span class="no">03</span>How do I enquire about a particular vehicle?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p>Each car page has an enquiry form that states the car, the year, the odometer and your
          contact details in one message, so nobody has to ask which Creta you mean. It composes an email on your device —
          nothing is stored on this website. Phone is faster if you want an answer the same day.</p></div></details>
      <details><summary><span class="no">04</span>Can I sell or exchange my existing car?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p>Yes. Used car exchange is one of the dealership&#8217;s published services, and the
          <a href="/sell-your-car">sell form</a> asks for the same details the showroom&#8217;s own form collects.
          {{PH:valuation}}.</p></div></details>
      <details><summary><span class="no">05</span>What documentation do I get with a car?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p>This site publishes what the listing states: registration city, odometer, fuel type and,
          where the dealer flagged it, service history. Ownership papers, insurance status and the PUC certificate come from
          the dealership on request — ask before you pay a booking amount. {{PH:inspection}}.</p></div></details>
      <details><summary><span class="no">06</span>Do you help with financing?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p>{{PH:finance}}. The specification list on each car page is a useful starting point for
          what a lender will want from you, and the showroom desk will point you at the paperwork.</p></div></details>
      <details><summary><span class="no">07</span>Where is the showroom located?<span class="sign" aria-hidden="true"></span></summary>
        <div class="faq__body"><p><a href="{{MAP_URL}}" target="_blank" rel="noopener">{{ADDRESS}}, {{ADDRESS_CITY}}</a> —
          listed in dealer directories as {{AREA}}. There is one address; no second showroom is published.
          <a href="/showroom">What to expect when you arrive →</a></p></div></details>
    </div>
  </div>
</section>

<!-- ======================================================== FINAL CTA === -->
<section class="cta" aria-labelledby="cta-h">
  <div class="wrap cta__inner">
    <div>
      <p class="kicker" style="color:var(--accent-soft)">Come and see one</p>
      <h2 id="cta-h">Your next drive<br>starts here.</h2>
      <p class="mb-0">Explore the collection, speak with our team, or come to {{AREA}} and look a car over before you
        decide anything.</p>
    </div>
    <div class="cta__actions">
      <a class="btn btn--bright" href="/inventory">Explore Available Cars
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></a>
      <a class="btn btn--line-dark" href="/contact#enquiry">Contact the showroom</a>
    </div>
  </div>
</section>

</main>`,
  "/about": `<main id="main">

<header class="pagehead band--surface">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span>
      <span aria-current="page">Our story</span></nav>
    <div class="head" style="margin-bottom:0">
      <div>
        <p class="kicker">Since {{YEAR}}</p>
        <h1 style="max-width:22ch">A dealership that answers<br>the phone and the question.</h1>
      </div>
      <div class="head__aside">
        <p class="lede" style="margin:0">Multi-brand, single address, run by the family that founded it. This page says
          what the business does, how it prices, and what it chooses to publish online.</p>
      </div>
    </div>
  </div>
</header>

<section class="band" aria-labelledby="story-1">
  <div class="wrap grid g-7-5">
    <div class="prose">
      <h2 id="story-1" class="sr-only">The dealership</h2>
      <p class="lede">Sohan Automobile was established in {{YEAR}} under {{LEAD}} and describes itself as West Bengal&#8217;s
        integrated multi-brand auto solution network. In practice that means one address in Beleghata where you can buy a
        car, hand over your old one, get the serviced, and sort the finance and insurance without being sent to three
        different offices.</p>
      <p>The company&#8217;s own words for its philosophy are the plainest ones available: transparency, delivery on time,
        and getting it right the first time. That is also the standard this website is held to — a listing either states a
        fact or it says the fact has not been published.</p>
      <p>Because the floor is multi-brand, the collection follows what is genuinely well kept rather than what any single
        manufacturer wants moved. You will find a 2025 XL6 beside a 2011 Estilo here, and both are presented the same way:
        year, variant, odometer, fuel, and asking price, with the photographs taken in the place the car actually
        sits.</p>

      <div class="pullquote" style="margin-top:clamp(26px,3vw,40px)">&#8220;We introduced ourselves as car dealers who have
        established their presence in the automobile market with a reputation of success.&#8221;</div>
      <p class="attr">From the dealership&#8217;s own About page</p>
    </div>
    <div class="stack-lg">
      {{PLACEHOLDER:Showroom front|Photograph of the Barowaritala Road frontage, 1200×900}}
      <dl class="spec-table tnum">
        <div><dt>Founded</dt><dd>{{YEAR}}, Kolkata</dd></div>
        <div><dt>Founded by</dt><dd>{{LEAD}}</dd></div>
        <div><dt>Ownership</dt><dd>Family-run</dd></div>
        <div><dt>Brands on the floor</dt><dd>Multi-brand</dd></div>
        <div><dt>Cars published here</dt><dd>{{PUBLISHED}} records</dd></div>
        <div><dt>Services</dt><dd>{{SERVICE_LIST}}</dd></div>
      </dl>
    </div>
  </div>
</section>

<section class="band band--dark dark" aria-labelledby="approach-h2">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">How we work</p>
        <h2 id="approach-h2">Sourcing, pricing and<br>paperwork.</h2>
      </div>
      <div class="head__aside">
        <p class="small" style="max-width:38ch;margin:0;color:var(--ink-2)">The three places where a used-car buyer
          usually gets an unsatisfactory answer, written down as this dealership handles them.</p>
      </div>
    </div>
    <div class="pillars" style="grid-template-columns:none">
      <div class="pillar"><span class="pillar__no">01 · Sourcing</span><h3>One car at a time</h3>
        <p>Cars are bought in individually by the people who resell them, including from owners trading up. A car that is
          hard to explain tends not to come in — which is the most useful thing about a small floor.</p></div>
      <div class="pillar"><span class="pillar__no">02 · Pricing</span><h3>One figure, discussed</h3>
        <p>The published price is the asking price, set per car rather than by a valuation engine. Where a listing records
          a reduction — the Vit&#8217;Brezza, for instance — the page says so instead of quietly changing the number.</p></div>
      <div class="pillar"><span class="pillar__no">03 · Paperwork</span><h3>Transfer handled in-house</h3>
        <p>RC transfer, insurance and the finance introductions come from the same desk that sold the car.
          {{PH:finance}}.</p></div>
    </div>
  </div>
</section>

<section class="band" aria-labelledby="floor-2-h">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">The floor</p>
        <h2 id="floor-2-h">Photographs from the yard,<br>not a studio.</h2>
      </div>
      <div class="head__aside">
        <p class="small dim" style="max-width:40ch;margin:0">These are the dealership&#8217;s own listing photographs of cars
          currently published on this site. Real light, real street, real number plates.</p>
      </div>
    </div>
    <div class="shot-grid">
      {{SHOTS:FLOOR}}
    </div>
    <div class="grid g-6-6" style="margin-top:clamp(30px,3.6vw,48px);gap:clamp(18px,2vw,26px)">
      {{PLACEHOLDER:Team|Staff at the counter — photographs not yet published:dark}}
      {{PLACEHOLDER:Service bay|The workshop the dealership advertises — 1200×900}}
    </div>
  </div>
</section>

<section class="band band--surface" aria-labelledby="publish-h">
  <div class="wrap grid g-7-5">
    <div>
      <p class="kicker">What this site publishes</p>
      <h2 id="publish-h">Deliberately incomplete,<br>rather than invented.</h2>
      <p class="lede">Used-car websites are usually built the other way round: everything gets an answer because a template
        demands one. We have done the opposite. If the listing did not state the transmission, the page says
        <em>not stated</em>. If no warranty programme is published, the site does not mention a warranty.</p>
      <ul class="policy-list">
        <li><b>Specifications</b> copied from the dealership&#8217;s published listings, dated {{VERIFIED}}.</li>
        <li><b>Photographs</b> taken by the dealership for those listings.</li>
        <li><b>No testimonials</b>, star ratings or awards, because none are published by the dealership.</li>
        <li><b>No inspection certificate, warranty or buy-back promise</b> is claimed anywhere on this site.</li>
        <li><b>Opening hours, social channels and finance terms</b> appear as labelled gaps until the dealership supplies them.</li>
      </ul>
      <a class="tlink" href="/legal#data">How the data was assembled</a>
    </div>
    <div class="notes" style="align-self:start">
      <h4>What is missing, and where it comes from</h4>
      <dl class="gap-list tnum">
        <div><dt>Opening hours</dt><dd>{{PH:hours}}</dd></div>
        <div><dt>Warranty</dt><dd>{{PH:warranty}}</dd></div>
        <div><dt>Inspection</dt><dd>{{PH:inspection}}</dd></div>
        <div><dt>Valuations</dt><dd>{{PH:valuation}}</dd></div>
        <div><dt>Test drives</dt><dd>{{PH:testdrive}}</dd></div>
        <div><dt>Social channels</dt><dd>{{PH:social}}</dd></div>
      </dl>
      <p class="small dim" style="margin:16px 0 0">Each of these is a line to fill in, not a decision to design around.
        Send the details to <a href="mailto:{{EMAIL}}">{{EMAIL}}</a> and the pages will carry them.</p>
    </div>
  </div>
</section>

<section class="cta" aria-labelledby="about-cta">
  <div class="wrap cta__inner">
    <div>
      <p class="kicker" style="color:var(--accent-soft)">Next step</p>
      <h2 id="about-cta">Come and see how it<br>actually works.</h2>
      <p class="mb-0">Fifteen minutes at {{AREA}} tells you more about this dealership than this page can.</p>
    </div>
    <div class="cta__actions">
      <a class="btn btn--bright" href="/showroom">Visit Our Showroom</a>
      <a class="btn btn--line-dark" href="/inventory">Browse the cars</a>
    </div>
  </div>
</section>

</main>`,
  "/showroom": `<main id="main">

<header class="pagehead band--surface">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span>
      <span aria-current="page">Our showroom</span></nav>
    <div class="head" style="margin-bottom:0">
      <div>
        <p class="kicker">One address · {{AREA}}</p>
        <h1 style="max-width:20ch">Where the cars are,<br>and where to park.</h1>
      </div>
      <div class="head__aside">
        <p class="lede" style="margin:0">A working forecourt rather than a glass box: the cars you see online are parked
          where you will find them, and the people who bought them are usually on the floor.</p>
        <a class="btn btn--solid" href="{{MAP_URL}}" target="_blank" rel="noopener">Open in Google Maps</a>
      </div>
    </div>
  </div>
</header>

<section class="band--sm" style="padding-top:clamp(26px,3vw,40px)" aria-label="Location and opening hours">
  <div class="wrap">
    {{CONTACT_GRID}}
  </div>
</section>

<section class="band" aria-labelledby="visit-h">
  <div class="wrap grid g-7-5">
    <div>
      <p class="kicker">A visit, start to finish</p>
      <h2 id="visit-h">Give yourself an hour.</h2>
      <ol class="steps">
        <li><span>01</span><div><b>Call before you come.</b> Confirm the car is on the floor and that someone can open it
          for you. Stock moves week to week; contact the showroom to confirm current stock and a viewing time.</div></li>
        <li><span>02</span><div><b>Walk around it cold.</b> Ask for the engine to be off when you arrive. A cold start
          tells you more than ten minutes of driving.</div></li>
        <li><span>03</span><div><b>Look at the papers, not just the paint.</b> RC, insurance expiry, PUC, service
          invoices. If a document is missing, that is worth knowing before a deposit is discussed.</div></li>
        <li><span>04</span><div><b>Drive it on your roads.</b> A two-lap loop proves nothing. Ask for the run to include
          a stretch you actually use — Bypass traffic, a flyover, a monsoon puddle if the season allows.</div></li>
        <li><span>05</span><div><b>Then decide at the counter.</b> Price, exchange of your car, finance introductions and
          RC transfer are all settled in the same place, with the same person.</div></li>
      </ol>
    </div>
    <aside class="stack-lg">
      <div class="notes">
        <h4>Getting there</h4>
        <p style="margin:0">{{ADDRESS}}, {{ADDRESS_CITY}}, described in dealer directories as {{AREA}}.
          <a href="{{MAP_URL}}" target="_blank" rel="noopener">Route directions in Google Maps</a>.
          Parking, landmark and access details have not been published by the dealership —
          <span class="to-confirm">to be confirmed</span>.</p>
      </div>
      <div class="notes">
        <h4>Bring</h4>
        <ul>
          <li>Your driving licence, if you intend to drive</li>
          <li>Your mechanic, if you want a second opinion before paying</li>
          <li>The registration paper of the car you are trading in</li>
        </ul>
      </div>
      <div class="shot-stack">
        {{SHOTS:xl6-2025,dzire-2025}}
      </div>
    </aside>
  </div>
</section>

<section class="band band--tint" aria-labelledby="floor-h3">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker">From the dealership</p>
        <h2 id="floor-h3">Photographs from<br>the dealership listings.</h2>
      </div>
      <div class="head__aside">
        <p class="small dim" style="max-width:36ch;margin:0">Listing photographs taken at this address. New arrivals replace
          them as cars are sold — this gallery and the <a href="/inventory">collection page</a> use the same current public inventory records.</p>
      </div>
    </div>
    <div class="shot-grid">
      {{SHOTS:brezza-2023,creta-2018,taigun-2022,venue-2020}}
    </div>
    {{PLACEHOLDER:Showroom interior|The counter, the waiting area, the ramp — 1600×900 recommended}}
  </div>
</section>

<section class="cta" aria-labelledby="showroom-cta">
  <div class="wrap cta__inner">
    <div>
      <p class="kicker" style="color:var(--accent-soft)">Agree a time</p>
      <h2 id="showroom-cta">Tell us which car, and<br>when you can come.</h2>
      <p class="mb-0">The form on the contact page reaches the same inbox the showroom uses. A phone call is faster.</p>
    </div>
    <div class="cta__actions">
      <a class="btn btn--bright" href="/contact#enquiry">Arrange a viewing</a>
      <a class="btn btn--line-dark" href="tel:{{PHONE_HREF}}">Call {{PHONE}}</a>
    </div>
  </div>
</section>

</main>`,
  "/contact": `<main id="main">

<header class="pagehead band--surface">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span>
      <span aria-current="page">Contact</span></nav>
    <div class="head" style="margin-bottom:0">
      <div>
        <p class="kicker">Contact</p>
        <h1 style="max-width:20ch">One number, one inbox,<br>one showroom.</h1>
      </div>
      <div class="head__aside">
        <p class="lede" style="margin:0">Buying, selling, servicing or a document you want to see before you travel —
          it all arrives at the same desk, so it does not matter which route you use.</p>
        <p class="small dim" style="margin:0">Fastest is the phone. {{PH:hours}}.</p>
      </div>
    </div>
  </div>
</header>

<section class="band--sm" style="padding-top:clamp(26px,3vw,40px)" aria-label="Contact details">
  <div class="wrap">
    {{CONTACT_GRID}}
  </div>
</section>

<section class="band" id="enquiry" aria-labelledby="enquiry-h">
  <div class="wrap grid g-7-5">
    <div>
      <p class="kicker">Send an enquiry</p>
      <h2 id="enquiry-h" style="font-size:var(--s3)">Ask about a car,<br>a viewing, or your own.</h2>
      <p class="lede" style="max-width:56ch">Pick the car if you have one in mind — the message then arrives with the year,
        odometer and price already written out, so nobody has to ask which Creta you mean.</p>

      <form class="form form--2" data-mailto="{{EMAIL}}" data-subject="Website enquiry — Sohan Automobile" novalidate>
        <div class="field form__full">
          <label for="q-about">What is this about?</label>
          <select id="q-about" name="Reason" required>
            <option value="">Select</option>
            <option>Enquiry about a car in stock</option>
            <option>Book a showroom viewing</option>
            <option>Home test drive request</option>
            <option>Sell or exchange my car</option>
            <option>Workshop service or repair</option>
            <option>Finance or insurance question</option>
            <option>Something else</option>
          </select>
          <span class="error-msg" role="alert">Choose one so it reaches the right person.</span>
        </div>
        <div class="field form__full">
          <label for="q-car">Which car?</label>
          <select id="q-car" name="Car">
            {{CAR_OPTIONS:optional}}
          </select>
          <span class="hint">Only the {{PUBLISHED}} cars published on this site are listed. For anything on the floor that
            is not online, say the model in your message and we will look it up.</span>
        </div>
        <div class="field">
          <label for="q-name">Your name <span class="req" aria-hidden="true">*</span></label>
          <input id="q-name" name="Name" type="text" required autocomplete="name">
          <span class="error-msg" role="alert">Please add your name.</span>
        </div>
        <div class="field">
          <label for="q-phone">Phone number <span class="req" aria-hidden="true">*</span></label>
          <input id="q-phone" name="Phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="+91 …">
          <span class="error-msg" role="alert">A number we can reach you on.</span>
        </div>
        <div class="field form__full">
          <label for="q-email">Email</label>
          <input id="q-email" name="Email" type="email" autocomplete="email">
          <span class="error-msg" role="alert">That address looks incomplete.</span>
        </div>
        <div class="field form__full">
          <label for="q-msg">Your message <span class="req" aria-hidden="true">*</span></label>
          <textarea id="q-msg" name="Message" required
            placeholder="What you want to know, and when you could come to Beleghata."></textarea>
          <span class="error-msg" role="alert">One line is enough — but we do need it.</span>
        </div>
        <div class="form__full" style="display:grid;gap:12px">
          <button class="btn btn--solid" type="submit">Send Enquiry
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></button>
          <p class="hint">This form does not post to a server. It opens your mail app with the message composed, and shows a
            copy button in case nothing opens — so nothing about you is stored by this website.</p>
          <div class="form__status" role="status" tabindex="-1"></div>
        </div>
      </form>
    </div>

    <aside class="stack-lg">
      <div class="notes">
        <h4>Which route is quickest</h4>
        <ul>
          <li><b>Is this car still available?</b> Phone. It is the only answer that is current to the minute.</li>
          <li><b>Can I see documents first?</b> Email, and ask for the specific papers by name.</li>
          <li><b>I want a home test drive.</b> Phone, then confirm in writing — the listing flag is not a booking.</li>
          <li><b>Selling my car.</b> Use the <a href="/sell-your-car">sell form</a>; photographs move it along faster.</li>
        </ul>
      </div>
      <div class="notes">
        <h4>What we will not tell you on email</h4>
        <p style="margin:0">A price for your car without seeing it, and a guarantee about a car we have not driven with you.
          {{PH:valuation}}. Everything else, ask.</p>
      </div>
      <div class="shot-stack">
        {{SHOTS:eeco-2012,estilo-2011}}
      </div>
    </aside>
  </div>
</section>

<section class="band band--surface" aria-labelledby="hours-h">
  <div class="wrap grid g-6-6" style="align-items:center">
    <div>
      <p class="kicker">Hours and access</p>
      <h2 id="hours-h" style="font-size:var(--s3);max-width:24ch">The one detail this page cannot yet publish.</h2>
    </div>
    <div>
      <p class="lede" style="margin:0 0 16px">The dealership has not published opening hours anywhere we could verify, so
        instead of inventing a tidy 10-to-8, this page says: call ahead. It is also the difference between a wasted trip
        and a car waiting with its keys on the counter.</p>
      <dl class="spec-table tnum">
        <div><dt>Published hours</dt><dd class="to-confirm">To be confirmed by the dealership</dd></div>
        <div><dt>Sunday / public holidays</dt><dd class="to-confirm">Not published</dd></div>
        <div><dt>Workshop cut-off</dt><dd class="to-confirm">Not published</dd></div>
        <div><dt>Best way to check</dt><dd><a href="tel:{{PHONE_HREF}}">{{PHONE}}</a></dd></div>
      </dl>
    </div>
  </div>
</section>

</main>`,
  "/sell-your-car": `<main id="main">

<header class="pagehead band--surface">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span>
      <span aria-current="page">Sell your car</span></nav>
    <div class="head" style="margin-bottom:0">
      <div>
        <p class="kicker">Sell or exchange</p>
        <h1 style="max-width:20ch">Ready for your next car?<br>Let&#8217;s talk about this one.</h1>
      </div>
      <div class="head__aside">
        <p class="lede" style="margin:0">Looking to sell your current vehicle? Share a few details with our team and let us
          discuss the next steps. No online valuation, no obligation — just enough information for us to know whether this
          is a car we can use.</p>
        <a class="tlink" href="tel:{{PHONE_HREF}}">Rather talk? {{PHONE}}</a>
      </div>
    </div>
  </div>
</header>

<section class="band" style="padding-top:clamp(30px,3.6vw,52px)">
  <div class="wrap grid g-7-5">

    <form class="form form--2" data-mailto="{{EMAIL}}" data-subject="Vehicle for sale — enquiry from the website" novalidate>
      <div class="field form__full"><p class="legend" style="margin:0">The car</p></div>

      <div class="field">
        <label for="s-make">Vehicle manufacturer <span class="req" aria-hidden="true">*</span></label>
        <input id="s-make" name="Manufacturer" type="text" required placeholder="e.g. Honda">
        <span class="error-msg" role="alert">We need the make.</span>
      </div>
      <div class="field">
        <label for="s-model">Model and variant <span class="req" aria-hidden="true">*</span></label>
        <input id="s-model" name="Model and variant" type="text" required placeholder="e.g. City VX CVT">
        <span class="error-msg" role="alert">Model and variant, please.</span>
      </div>
      <div class="field">
        <label for="s-year">Year of manufacture <span class="req" aria-hidden="true">*</span></label>
        <input id="s-year" name="Year" type="number" min="1975" max="2026" required inputmode="numeric" placeholder="2019">
        <span class="error-msg" role="alert">Four digits.</span>
      </div>
      <div class="field">
        <label for="s-km">Approximate kilometres driven</label>
        <input id="s-km" name="Odometer" type="text" inputmode="numeric" placeholder="e.g. 62,000">
        <span class="hint">From the instrument cluster, not from memory of last year.</span>
      </div>
      <div class="field">
        <label for="s-owner">Owner sequence</label>
        <select id="s-owner" name="Owner sequence">
          <option value="">Select if you know</option>
          <option>First owner</option><option>Second owner</option><option>Third owner</option><option>Four or more</option>
        </select>
      </div>
      <div class="field">
        <label for="s-ins">Insurance status</label>
        <select id="s-ins" name="Insurance">
          <option value="">Select</option>
          <option>Comprehensive, valid</option><option>Third party, valid</option>
          <option>Expired</option><option>Not sure</option>
        </select>
      </div>

      <div class="field form__full"><p class="legend" style="margin:0;padding-top:8px">You and the car&#8217;s location</p></div>

      <div class="field">
        <label for="s-name">Full name <span class="req" aria-hidden="true">*</span></label>
        <input id="s-name" name="Name" type="text" required autocomplete="name">
        <span class="error-msg" role="alert">Please add your name.</span>
      </div>
      <div class="field">
        <label for="s-phone">Contact number <span class="req" aria-hidden="true">*</span></label>
        <input id="s-phone" name="Phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="+91 …">
        <span class="error-msg" role="alert">A number we can reach you on.</span>
      </div>
      <div class="field">
        <label for="s-email">Email</label>
        <input id="s-email" name="Email" type="email" autocomplete="email">
        <span class="error-msg" role="alert">That address looks incomplete.</span>
      </div>
      <div class="field">
        <label for="s-city">Where is the car? <span class="req" aria-hidden="true">*</span></label>
        <input id="s-city" name="Location" type="text" required placeholder="Kolkata – Beleghata, Howrah, other">
        <span class="error-msg" role="alert">A locality is enough.</span>
      </div>
      <div class="field form__full">
        <label for="s-details">Additional details</label>
        <textarea id="s-details" name="Notes"
          placeholder="Modifications, dent or panel work, service records you have kept, why you are selling, and a good time to call."></textarea>
        <span class="hint">Photographs help — attach them in the email your mail app opens, or have them ready when we call.</span>
      </div>

      <div class="form__full" style="display:grid;gap:12px;padding-top:4px">
        <fieldset>
          <legend class="legend" style="margin-bottom:9px">Condition, as you would describe it</legend>
          <div class="radios">
            <label><input type="radio" name="Condition" value="Excellent">Excellent</label>
            <label><input type="radio" name="Condition" value="Good" checked>Good</label>
            <label><input type="radio" name="Condition" value="Fair">Fair</label>
            <label><input type="radio" name="Condition" value="Needs work">Needs work</label>
          </div>
        </fieldset>
        <button class="btn btn--solid" type="submit">Submit Vehicle Details
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg></button>
        <p class="hint">Nothing is uploaded. Your mail app opens with everything above written out as a message to
          <a href="mailto:{{EMAIL}}">{{EMAIL}}</a>; if it does not open, a copy button appears and you can paste it into any
          email. We reply on working days.</p>
        <div class="form__status" role="status" tabindex="-1"></div>
      </div>
    </form>

    <aside class="stack-lg">
      <div class="notes">
        <h4>What happens next</h4>
        <ul>
          <li>We call or email to agree a time to see the car.</li>
          <li>Inspection at {{ADDRESS}} — or at your address inside Kolkata.</li>
          <li>A figure is discussed after the car has been looked at, not from this form.</li>
          <li>Purchase or exchange, then RC transfer and settlement arranged from the same desk.</li>
        </ul>
      </div>
      <div class="notes">
        <h4>Have these to hand</h4>
        <ul>
          <li>Registration certificate and insurance paper</li>
          <li>Service invoices, if they were kept</li>
          <li>Both keys</li>
          <li>ID for the transfer forms</li>
        </ul>
      </div>
      <div class="shot-stack">
        {{SHOTS:sonet-2023,polo-2017}}
      </div>
      <div class="notes">
        <h4>Selling or exchanging</h4>
        <p style="margin:0">Exchange is a published service of this dealership, so if a car on the
          <a href="/inventory">floor</a> is your next one, the two figures can be settled against each other instead of
          you going out and back with cash.</p>
      </div>
    </aside>
  </div>
</section>

<section class="band band--tint" aria-labelledby="why-form-h">
  <div class="wrap grid g-6-6" style="align-items:center">
    <div>
      <p class="kicker">Why we ask for this</p>
      <h2 id="why-form-h" style="font-size:var(--s3);max-width:26ch">Eight fields, because a valuation needs a car.</h2>
    </div>
    <p class="lede" style="margin:0">An instant online figure is arithmetic on assumptions: the model, the year and an
      average odometer. It costs nothing to produce and it is wrong often enough that sellers stop believing dealers. These
      fields exist so the first conversation is about your car — its history, its finish, what has been replaced — and so
      the inspection is worth both parties&#8217; time.</p>
  </div>
</section>

<section class="cta" aria-labelledby="sell-cta">
  <div class="wrap cta__inner">
    <div>
      <p class="kicker" style="color:var(--accent-soft)">Not sure yet?</p>
      <h2 id="sell-cta">Bring it to the counter<br>and ask.</h2>
      <p class="mb-0">No paperwork, no commitment. Drive to {{AREA}}, and if the figure does not work for you, drive home
        with the car and a better idea of what it is worth.</p>
    </div>
    <div class="cta__actions">
      <a class="btn btn--bright" href="tel:{{PHONE_HREF}}">Call {{PHONE}}</a>
      <a class="btn btn--line-dark" href="/inventory">See what we have</a>
    </div>
  </div>
</section>

</main>`,
  "/legal": `<main id="main">

<header class="pagehead band--surface">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span>
      <span aria-current="page">Privacy and terms</span></nav>
    <p class="kicker">Plain language</p>
    <h1 style="max-width:22ch">Privacy, terms, and where<br>this data came from.</h1>
    <p class="lede" style="margin-top:6px;max-width:52ch">Three things a car website usually buries, written out because
      they are short.</p>
  </div>
</header>

<section class="band" style="padding-top:clamp(28px,3.2vw,44px)" aria-labelledby="privacy-h">
  <div class="wrap wrap--tight">
    <h2 id="privacy-h" style="font-size:var(--s3)">Privacy</h2>
    <p>Public browsing runs no analytics or advertising cookies. When staff authentication is enabled, invited staff use essential secure authentication cookies and Supabase processes staff account data. Its fonts, photographs and script are served from the same place as
      the pages, so your browser asks nothing of a third party while you browse — no ad network learns that you looked at a
      Creta.</p>
    <p>The enquiry and sale forms do not transmit data to a server. They compose an email on your own device: the fields are
      written out into a message in your mail app, and nothing leaves the device unless you press send. No customer account, no enquiry storage, no tracking pixel, no newsletter signup.</p>
    <p>If you email or telephone the showroom, the dealership&#8217;s ordinary business records apply — your contact details,
      the car in question and the content of the conversation. Ask for those records to be removed by writing to
      <a href="mailto:{{EMAIL}}">{{EMAIL}}</a>; a photograph you send for a valuation sits in their inbox until they delete
      it, so say if you want it gone.</p>

    <h2 id="terms" style="font-size:var(--s3);margin-top:clamp(30px,3.4vw,46px)">Terms and conditions</h2>
    <div class="notes">
      <h4>Draft — requires the dealership&#8217;s sign-off</h4>
      <p style="margin:0">The dealership publishes no terms of sale on its existing website, so nothing here should be read
        as an agreement. Before this section is finalised, the owner should confirm: booking-amount and refund terms, the
        &#8220;as inspected&#8221; wording for each car, who bears RC transfer charges and road-tax liability, how an
        exchange value is adjusted, and the route for a complaint. This page exists so those decisions are visible rather
        than quietly invented by whoever builds the next page.</p>
    </div>
    <ul class="policy-list" style="margin-top:22px">
      <li><b>The seller</b> is Sohan Automobile, {{ADDRESS}}, {{ADDRESS_CITY}}. This website presents the dealership&#8217;s
        listings; it is not a marketplace and it sells nothing itself.</li>
      <li><b>Prices</b> are the asking figures published on the dealership&#8217;s listings as at {{VERIFIED}}. They are
        quotable at the counter on the day, not binding from a webpage.</li>
      <li><b>Availability</b> changes continuously. A car shown here may be reserved or sold; confirm by phone
        (<a href="tel:{{PHONE_HREF}}">{{PHONE}}</a>) before travelling.</li>
      <li><b>Condition</b> is described from the listing and from inspection at the showroom. This site publishes no
        independent inspection report, warranty or certification for any car.</li>
      <li><b>Finance and insurance</b> are arranged by their providers. {{PH:finance}}, and no approval is implied by a
        listing.</li>
    </ul>

    <h2 id="data" style="font-size:var(--s3);margin-top:clamp(30px,3.4vw,46px)">About our listing data</h2>
    <p>Every specification, photograph and price on this site is taken from the dealership&#8217;s own published material:
      its website at <a href="{{SOURCE_SITE}}">{{SOURCE_SITE}}</a> for the company details, and its dealer-directory
      listings at <a href="{{SOURCE_INVENTORY}}">{{SOURCE_INVENTORY}}</a> for the individual cars, captured on
      {{VERIFIED}}.</p>
    <p>Where a published listing stated nothing — a transmission type, most often — the page records
      <em>not stated in the listing</em>. Fields are never inferred from the model name, because a variant that exists in a
      brochure need not be the car on the floor. The completeness line on each vehicle page tells you how many of the seven
      standard fields that car&#8217;s listing actually carried.</p>
    <p>The dealership reports roughly {{FLOOR}} cars on its books, of which {{PUBLISHED}} are published with photographs
      online; the remainder are sold directly from the forecourt. That gap is stated on the collection page rather than
      hidden behind a &#8220;view all&#8221; button that leads nowhere.</p>
    <div class="notes" style="margin-top:22px">
      <h4>Corrections</h4>
      <p style="margin:0">If you are the dealership and a figure here is stale, or you are a buyer and a car was not as
        described, write to <a href="mailto:{{EMAIL}}">{{EMAIL}}</a> with the listing reference
      (each vehicle page prints one). Listing data is regenerated from a single file, so a correction lands everywhere at
      once — on the card, the filters and the vehicle page.</p>
    </div>
  </div>
</section>

</main>`,
};
