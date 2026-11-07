import { raw } from "hono/html";
import { dateLong, plain, safeHtml } from "@/lib/format";
import { Flash, Layout, type Ctx } from "@/ui/layout";
import { PostCard } from "@/ui/cards";
import { EnquiryForm } from "@/pages/trips";

export function BlogList({ ctx, posts }: { ctx: Ctx; posts: Record<string, any>[] }) {
  return (
    <Layout ctx={ctx} title="Journal" description="Stories, guides and ideas for your next trip.">
      <div class="wrap page-head">
        <h1>Journal</h1>
        <p>Stories, guides and ideas for your next trip.</p>
      </div>
      <div class="wrap" style="padding-bottom:96px">
        {posts.length ? (
          <div class="grid">
            {posts.map((p) => (
              <PostCard post={p} base={ctx.base} />
            ))}
          </div>
        ) : (
          <div class="note">Nothing published yet. Check back soon.</div>
        )}
      </div>
    </Layout>
  );
}

export function PostPage({ ctx, post }: { ctx: Ctx; post: Record<string, any> }) {
  return (
    <Layout ctx={ctx} title={post.metaTitle || post.title} description={post.metaDescription || plain(post.content, 160)} image={post.coverImage}>
      <article class="wrap" style="padding-top:56px;padding-bottom:96px;max-width:900px">
        <div class="crumbs">
          <a href={`${ctx.base}/blog`}>Journal</a>
        </div>
        <h1 style="font-size:clamp(2.4rem,6vw,4.4rem);letter-spacing:-0.05em;line-height:1">{post.title}</h1>
        <p class="muted" style="margin-top:22px">
          {[dateLong(post.publishedAt ?? post.createdAt), post.writer?.name ?? post.author?.name].filter(Boolean).join(" · ")}
        </p>
        {post.coverImage ? <img src={post.coverImage} alt="" style="margin:44px 0;border-radius:28px;width:100%;aspect-ratio:16/9;object-fit:cover" /> : null}
        <div class="prose" style="margin:0 auto">{raw(safeHtml(post.content))}</div>
        {post.writer?.name && post.writer?.bio ? (
          <div class="review" style="margin-top:64px;max-width:70ch">
            <strong>{post.writer.name}</strong>
            <p class="muted" style="margin-top:6px">{post.writer.bio}</p>
          </div>
        ) : null}
      </article>
    </Layout>
  );
}

export function InfoPage({ ctx, page }: { ctx: Ctx; page: Record<string, any> }) {
  return (
    <Layout ctx={ctx} title={page.metaTitle || page.title} description={page.metaDescription || plain(page.content, 160)} image={page.coverImage}>
      <div class="wrap page-head">
        <h1>{page.title}</h1>
      </div>
      <div class="wrap" style="padding-bottom:104px">
        {page.coverImage ? <img src={page.coverImage} alt="" style="margin-bottom:48px;border-radius:28px;width:100%;aspect-ratio:21/9;object-fit:cover" /> : null}
        <div class="prose">{raw(safeHtml(page.content))}</div>
      </div>
    </Layout>
  );
}

export function Contact({ ctx, flash }: { ctx: Ctx; flash: { sent?: string; error?: string } }) {
  const { company } = ctx.site;
  return (
    <Layout ctx={ctx} title="Plan a trip" description="Tell us where you want to go and we will help you plan it.">
      <div class="wrap page-head">
        <h1>Plan a trip</h1>
        <p>Tell us where you want to go, when, and who is coming. The team will reply with ideas and dates.</p>
      </div>
      <div class="wrap" style="padding-bottom:104px">
        <div class="two" style="grid-template-columns:1fr 1fr;align-items:start">
          <div>
            <Flash sent={flash.sent} error={flash.error} />
            <EnquiryForm base={ctx.base} back={`${ctx.base}/contact`} />
          </div>
          <div class="muted" style="font-size:1.1rem">
            {company.email ? <p>{company.email}</p> : null}
            {company.phone ? <p style="margin-top:8px">{company.phone}</p> : null}
            {company.address ? <p style="margin-top:8px">{company.address}</p> : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export function Problem({ title, text, base }: { title: string; text: string; base?: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>{title}</title>
        <style>{raw("body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100svh;padding:24px;color:#0b0b0b}main{max-width:520px}h1{font-size:2.6rem;letter-spacing:-0.04em;line-height:1.05;margin:0 0 16px}p{color:#66645f;line-height:1.6;font-size:1.1rem;margin:0}a{display:inline-block;margin-top:28px;background:#0b0b0b;color:#fff;border-radius:999px;padding:12px 24px;text-decoration:none;font-weight:600}")}</style>
      </head>
      <body>
        <main>
          <h1>{title}</h1>
          <p>{text}</p>
          {base !== undefined ? <a href={base || "/"}>Back to the home page</a> : null}
        </main>
      </body>
    </html>
  );
}
