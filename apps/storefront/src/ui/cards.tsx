import { dateShort, images, money, plain } from "@/lib/format";
import type { Trip } from "@/lib/api";

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export const Photo = ({ src, name }: { src?: string | null; name: string }) => (
  <div class={src ? "ph" : "ph empty"}>{src ? <img src={src} alt="" loading="lazy" /> : initials(name)}</div>
);

export function TripCard({ trip, base, currency }: { trip: Trip; base: string; currency: string }) {
  const cover = trip.image ?? images(trip.images)[0] ?? null;
  const rating = Number(trip.averageRating ?? 0);
  return (
    <a class="card" href={`${base}/trips/${trip.slug}`}>
      <Photo src={cover} name={trip.title} />
      <h3>{trip.title}</h3>
      <div class="meta">
        {trip.duration ? <span>{trip.duration}</span> : null}
        {trip.difficultyLevel ? <span>{String(trip.difficultyLevel).charAt(0) + String(trip.difficultyLevel).slice(1).toLowerCase()}</span> : null}
        {rating > 0 ? <span>★ {rating.toFixed(1)}</span> : null}
      </div>
      {trip.price != null ? <div class="price">From {money(Number(trip.price), currency)}</div> : null}
    </a>
  );
}

export function PostCard({ post, base }: { post: Record<string, any>; base: string }) {
  return (
    <a class="card" href={`${base}/blog/${post.slug}`}>
      <Photo src={post.coverImage} name={post.title ?? ""} />
      <h3>{post.title}</h3>
      <div class="meta">
        {post.publishedAt ? <span>{dateShort(post.publishedAt)}</span> : null}
      </div>
      {post.metaDescription ? <p class="muted" style="margin-top:8px;font-size:15px">{plain(post.metaDescription, 120)}</p> : null}
    </a>
  );
}
