import { dateShort, images, money, plain } from "@/lib/format";
import type { Trip } from "@/lib/api";

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export const Photo = ({ src, name }: { src?: string | null; name: string }) => (
  <div class={src ? "ph" : "ph empty"}>{src ? <img src={src} alt="" loading="lazy" /> : initials(name)}</div>
);

const cover = (trip: Trip) => trip.image ?? images(trip.images)[0] ?? null;
const tripMeta = (trip: Trip) => [
  trip.duration,
  trip.difficultyLevel ? String(trip.difficultyLevel).charAt(0) + String(trip.difficultyLevel).slice(1).toLowerCase() : null,
  Number(trip.averageRating ?? 0) > 0 ? `★ ${Number(trip.averageRating).toFixed(1)}` : null,
].filter(Boolean) as string[];

export function TripCard({ trip, base, currency }: { trip: Trip; base: string; currency: string }) {
  return (
    <a class="card" href={`${base}/trips/${trip.slug}`}>
      <Photo src={cover(trip)} name={trip.title} />
      <h3>{trip.title}</h3>
      {tripMeta(trip).length ? (
        <div class="meta">
          {tripMeta(trip).map((m) => (
            <span>{m}</span>
          ))}
        </div>
      ) : null}
      {trip.price != null ? <div class="price">From {money(Number(trip.price), currency)}</div> : null}
    </a>
  );
}

/** The first trip on a page, treated as the lead story. */
export function TripFeature({ trip, base, currency }: { trip: Trip; base: string; currency: string }) {
  const dek = plain(trip.overview, 200);
  return (
    <a class="feature" href={`${base}/trips/${trip.slug}`}>
      <Photo src={cover(trip)} name={trip.title} />
      <div class="body">
        <div class="kicker">Featured trip</div>
        <h3>{trip.title}</h3>
        {dek ? <p class="dek">{dek}</p> : null}
        {tripMeta(trip).length ? (
          <div class="meta">
            {tripMeta(trip).map((m) => (
              <span>{m}</span>
            ))}
          </div>
        ) : null}
        {trip.price != null ? <div class="price">From {money(Number(trip.price), currency)} per person</div> : null}
        <span class="go">View trip →</span>
      </div>
    </a>
  );
}

export function PostCard({ post, base }: { post: Record<string, any>; base: string }) {
  return (
    <a class="card" href={`${base}/blog/${post.slug}`}>
      <Photo src={post.coverImage} name={post.title ?? ""} />
      <h3>{post.title}</h3>
      <div class="meta">{post.publishedAt ? <span>{dateShort(post.publishedAt)}</span> : null}</div>
      {post.metaDescription ? <p class="muted" style="margin-top:10px;font-size:15px">{plain(post.metaDescription, 130)}</p> : null}
    </a>
  );
}

/** The first story in the journal, treated as the cover story. */
export function PostFeature({ post, base }: { post: Record<string, any>; base: string }) {
  return (
    <a class="post-feature" href={`${base}/blog/${post.slug}`}>
      <Photo src={post.coverImage} name={post.title ?? ""} />
      <div class="body">
        <div class="kicker">From the journal</div>
        <h3>{post.title}</h3>
        {post.metaDescription ? <p class="dek">{plain(post.metaDescription, 180)}</p> : null}
        <div class="meta">{[dateShort(post.publishedAt ?? post.createdAt), post.writer?.name ?? post.author?.name].filter(Boolean).join(" · ")}</div>
      </div>
    </a>
  );
}

/** A compact journal row: text on the left, thumbnail on the right. */
export function PostRow({ post, base }: { post: Record<string, any>; base: string }) {
  return (
    <a class="post-row" href={`${base}/blog/${post.slug}`}>
      <div>
        <div class="meta">{[dateShort(post.publishedAt ?? post.createdAt), post.writer?.name ?? post.author?.name].filter(Boolean).join(" · ")}</div>
        <h3>{post.title}</h3>
        {post.metaDescription ? <p class="dek">{plain(post.metaDescription, 150)}</p> : null}
      </div>
      <Photo src={post.coverImage} name={post.title ?? ""} />
    </a>
  );
}
