import { raw } from "hono/html";
import type { Trip } from "@/lib/api";
import { dateLong, images, list, money, plain, safeHtml, stars } from "@/lib/format";
import { Flash, Layout, type Ctx } from "@/ui/layout";
import { TripCard } from "@/ui/cards";

export function TripList({
  ctx,
  trips,
  categories,
  heading,
  intro,
  activeCategory,
}: {
  ctx: Ctx;
  trips: Trip[];
  categories: Record<string, any>[];
  heading: string;
  intro?: string | null;
  activeCategory?: string;
}) {
  const { base } = ctx;
  return (
    <Layout ctx={ctx} title={heading} description={intro}>
      <div class="wrap page-head">
        <h1>{heading}</h1>
        {intro ? <p>{intro}</p> : null}
        {categories.length ? (
          <div class="pills" style="margin-top:36px">
            <a class={activeCategory ? "pill" : "pill on"} href={`${base}/trips`}>
              All trips
            </a>
            {categories.map((c) => (
              <a class={activeCategory === c.handle ? "pill on" : "pill"} href={`${base}/trips/category/${c.handle}`}>
                {c.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div class="wrap" style="padding-bottom:96px">
        {trips.length ? (
          <div class="grid">
            {trips.map((t) => (
              <TripCard trip={t} base={base} currency={ctx.currency} />
            ))}
          </div>
        ) : (
          <div class="note">No trips to show here yet. Check back soon.</div>
        )}
      </div>
    </Layout>
  );
}

type Day = { title?: string; description?: string; duration?: string; distance?: string; ascent?: string; descent?: string; meals?: string; accommodations?: string; dayFeaturedImages?: { image: string }[] };
type Variant = { name?: string; isDefault?: boolean; description?: string; days?: Day[] };

/** Trips store their plan as variants, but older ones may hold a plain list of days. Both read the same here. */
const variantsOf = (itinerary: unknown): Variant[] => {
  const items = list<any>(itinerary);
  if (!items.length) return [];
  return items[0] && Array.isArray(items[0].days) ? (items as Variant[]) : [{ days: items as Day[] }];
};

const Accordion = ({ title, open, children }: { title: string; open?: boolean; children: any }) => (
  <details class="acc" open={open}>
    <summary>{title}</summary>
    <div class="in">{children}</div>
  </details>
);

const Html = ({ html }: { html?: string | null }) => <div class="prose">{raw(safeHtml(html))}</div>;
const has = (html?: string | null) => plain(html, 5).length > 0;

export function TripPage({
  ctx,
  trip,
  departures,
  reviews,
  flash,
}: {
  ctx: Ctx;
  trip: Trip;
  departures: Record<string, any>[];
  reviews: Record<string, any>[];
  flash: { sent?: string; error?: string };
}) {
  const { base, currency } = ctx;
  const gallery = images(trip.images).slice(0, 5);
  const variants = variantsOf(trip.itinerary);
  const faq = list<{ title?: string; items?: { q: string; a: string }[] }>(trip.faq);
  const info = list<{ title: string; description: string }>(trip.additionalInfo);
  const rating = Number(trip.averageRating ?? 0);
  const stay = list<string>(trip.accommodations);
  const meals = list<string>(trip.meals);
  const price = trip.price != null ? Number(trip.price) : null;
  const maxPrice = trip.maxPrice != null ? Number(trip.maxPrice) : null;
  const facts = [
    trip.duration,
    trip.difficultyLevel ? String(trip.difficultyLevel).charAt(0) + String(trip.difficultyLevel).slice(1).toLowerCase() : null,
    trip.guestCapacity ? `Up to ${trip.guestCapacity} people` : null,
    trip.maximumAltitude ? `Max altitude ${Number(trip.maximumAltitude).toLocaleString("en")} m` : null,
  ].filter(Boolean) as string[];

  return (
    <Layout ctx={ctx} title={trip.tripSeo?.metaTitle || trip.title} description={trip.tripSeo?.metaDescription || plain(trip.overview, 160)} image={trip.tripSeo?.featuredMedia ?? gallery[0]}>
      <div class="wrap" style="padding-top:48px">
        <div class="crumbs">
          <a href={`${base}/trips`}>Trips</a> / {trip.title}
        </div>
        <h1 style="font-size:clamp(2.4rem,6vw,4.6rem);letter-spacing:-0.05em;max-width:18ch">{trip.title}</h1>
        <div class="facts">
          {rating > 0 ? (
            <span class="fact">
              <span class="stars">{stars(rating)}</span> {rating.toFixed(1)}
            </span>
          ) : null}
          {facts.map((f) => (
            <span class="fact">{f}</span>
          ))}
        </div>

        {gallery.length ? (
          <div class={gallery.length === 1 ? "gallery one" : "gallery"}>
            {gallery.map((src) => (
              <img src={src} alt="" loading="lazy" />
            ))}
          </div>
        ) : null}

        <div class="detail">
          <div>
            {has(trip.overview) ? (
              <section class="block2">
                <Html html={trip.overview} />
              </section>
            ) : null}
            {has(trip.highlights) ? (
              <section class="block2">
                <h2>Highlights</h2>
                <Html html={trip.highlights} />
              </section>
            ) : null}
            {has(trip.content) ? (
              <section class="block2">
                <Html html={trip.content} />
              </section>
            ) : null}

            {variants.length ? (
              <section class="block2" id="itinerary">
                <h2>Itinerary</h2>
                {variants.map((v) => (
                  <div style={variants.length > 1 ? "margin-bottom:36px" : ""}>
                    {variants.length > 1 && v.name ? <h3 style="margin-bottom:12px;font-size:1.4rem">{v.name}</h3> : null}
                    {has(v.description) ? <Html html={v.description} /> : null}
                    {(v.days ?? []).map((d, i) => (
                      <Accordion title={`Day ${i + 1}${d.title ? ` · ${d.title}` : ""}`} open={i === 0}>
                        <div class="facts" style="margin:0 0 16px">
                          {[d.duration, d.distance, d.ascent ? `Ascent ${d.ascent}` : null, d.descent ? `Descent ${d.descent}` : null, d.meals ? `Meals: ${d.meals}` : null, d.accommodations ? `Stay: ${d.accommodations}` : null]
                            .filter(Boolean)
                            .map((f) => (
                              <span class="fact">{f}</span>
                            ))}
                        </div>
                        <Html html={d.description} />
                        {d.dayFeaturedImages?.length ? (
                          <div class="review" style="border:0;padding:0">
                            <div class="imgs">
                              {d.dayFeaturedImages.map((im) => (
                                <img src={im.image} alt="" loading="lazy" />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </Accordion>
                    ))}
                  </div>
                ))}
              </section>
            ) : null}

            {has(trip.inclusions) || has(trip.exclusions) ? (
              <section class="block2">
                <div class="cols">
                  {has(trip.inclusions) ? (
                    <div>
                      <h2 style="font-size:1.6rem;margin-bottom:14px">What's included</h2>
                      <div class="prose">{raw(safeHtml(trip.inclusions))}</div>
                    </div>
                  ) : null}
                  {has(trip.exclusions) ? (
                    <div>
                      <h2 style="font-size:1.6rem;margin-bottom:14px">Not included</h2>
                      <div class="prose">{raw(safeHtml(trip.exclusions))}</div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {trip.meetingPoint || trip.dropOffPoint || stay.length || meals.length ? (
              <section class="block2">
                <h2>Good to know</h2>
                <div class="cols">
                  {trip.meetingPoint ? (
                    <div>
                      <h4 style="font-size:1rem;letter-spacing:0">Meeting point</h4>
                      <p class="muted">{trip.meetingPoint}</p>
                    </div>
                  ) : null}
                  {trip.dropOffPoint ? (
                    <div>
                      <h4 style="font-size:1rem;letter-spacing:0">Drop-off point</h4>
                      <p class="muted">{trip.dropOffPoint}</p>
                    </div>
                  ) : null}
                  {stay.length ? (
                    <div>
                      <h4 style="font-size:1rem;letter-spacing:0">Where you stay</h4>
                      <p class="muted">{stay.join(", ")}</p>
                    </div>
                  ) : null}
                  {meals.length ? (
                    <div>
                      <h4 style="font-size:1rem;letter-spacing:0">Meals</h4>
                      <p class="muted">{meals.join(", ")}</p>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {trip.routeMap ? (
              <section class="block2">
                <h2>Route</h2>
                <img src={trip.routeMap} alt="Route map" style="border-radius:var(--radius);width:100%" loading="lazy" />
                {has(trip.mapDescription) ? (
                  <div style="margin-top:20px">
                    <Html html={trip.mapDescription} />
                  </div>
                ) : null}
              </section>
            ) : null}

            {info.length ? (
              <section class="block2">
                <h2>Before you book</h2>
                {info.map((i) => (
                  <Accordion title={i.title}>
                    <Html html={i.description} />
                  </Accordion>
                ))}
              </section>
            ) : null}

            {faq.length ? (
              <section class="block2">
                <h2>Questions</h2>
                {faq.map((g) => (
                  <div style="margin-bottom:28px">
                    {g.title ? <h3 style="font-size:1.1rem;margin-bottom:6px;color:var(--muted);letter-spacing:0;font-weight:500">{g.title}</h3> : null}
                    {(g.items ?? []).map((q) => (
                      <Accordion title={q.q}>
                        <Html html={q.a} />
                      </Accordion>
                    ))}
                  </div>
                ))}
              </section>
            ) : null}

            {reviews.length ? (
              <section class="block2">
                <h2>What travellers say</h2>
                <div style="display:grid;gap:18px">
                  {reviews.map((r) => (
                    <div class="review">
                      <div class="stars">{stars(r.rating)}</div>
                      {r.title ? <h3 style="font-size:1.25rem;margin-top:10px">{r.title}</h3> : null}
                      {r.text ? <p style="margin-top:8px">{r.text}</p> : null}
                      <p class="muted" style="margin-top:12px;font-size:14px">
                        {r.author}
                      </p>
                      {Array.isArray(r.images) && r.images.length ? (
                        <div class="imgs">
                          {r.images.map((src: string) => (
                            <img src={src} alt="" loading="lazy" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside>
            <div class="sticky">
              {price != null ? (
                <>
                  <div class="from">From</div>
                  <div class="amt">
                    {money(price, currency)}
                    {maxPrice && maxPrice > price ? <span class="muted" style="font-size:20px"> – {money(maxPrice, currency)}</span> : null}
                  </div>
                  <div class="from">per person</div>
                </>
              ) : (
                <div class="amt" style="font-size:28px">
                  Ask us for a price
                </div>
              )}
              <p style="margin-top:22px">
                <a class="btn" style="width:100%" href="#enquire">
                  Enquire about this trip
                </a>
              </p>
              {departures.length ? (
                <div class="dep">
                  <strong style="display:block;margin-bottom:6px">Upcoming departures</strong>
                  {departures.map((d) => (
                    <div>
                      <span>{dateLong(d.startDate)}</span>
                      <span class="muted">{d.price != null ? money(Number(d.price), currency) : ""}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <section id="enquire" class="block2" style="margin-top:72px;margin-bottom:96px">
          <div class="two" style="grid-template-columns:1fr 1fr;align-items:start">
            <div>
              <h2 style="font-size:clamp(2rem,4vw,3rem)">Interested in {trip.title}?</h2>
              <p class="muted" style="margin-top:16px;max-width:40ch">Send a message and the team will reply with dates, availability and anything else you want to know.</p>
            </div>
            <div>
              <Flash sent={flash.sent} error={flash.error} />
              <EnquiryForm base={base} back={`${base}/trips/${trip.slug}#enquire`} trip={trip.title} />
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export function EnquiryForm({ base, back, trip }: { base: string; back: string; trip?: string }) {
  return (
    <form class="stack" method="post" action={`${base}/_/inquiry`}>
      <input type="hidden" name="back" value={back} />
      {trip ? <input type="hidden" name="trip" value={trip} /> : null}
      <label class="f">
        Your name
        <input name="name" required autocomplete="name" />
      </label>
      <label class="f">
        Email
        <input type="email" name="email" required autocomplete="email" />
      </label>
      <label class="f">
        Phone <span class="muted" style="font-weight:400">(optional)</span>
        <input name="phone" autocomplete="tel" />
      </label>
      <label class="f">
        Message
        <textarea name="message" rows={5} required></textarea>
      </label>
      <div>
        <button class="btn" type="submit">
          Send message
        </button>
      </div>
    </form>
  );
}
