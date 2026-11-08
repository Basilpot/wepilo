import { raw } from "hono/html";
import { dateLong, plain, safeHtml } from "@/lib/format";
import { Flash, Layout, type Ctx } from "@/ui/layout";
import { PostFeature, PostRow } from "@/ui/cards";
import { EnquiryForm } from "@/pages/trips";

export function BlogList({ ctx, posts }: { ctx: Ctx; posts: Record<string, any>[] }) {
  return (
    <Layout ctx={ctx} title="Journal" description="Stories, guides and ideas for your next trip.">
      <div class="wrap page-head">
        <h1>Journal</h1>
        <p>Stories, guides and ideas for your next trip.</p>
      </div>
      <div class="wrap" style="padding-bottom:clamp(64px,9vw,128px)">
        {posts.length ? (
          <>
            <PostFeature post={posts[0]} base={ctx.base} />
            {posts.length > 1 ? (
              <div class="post-list">
                {posts.slice(1).map((p) => (
                  <PostRow post={p} base={ctx.base} />
                ))}
              </div>
            ) : null}
          </>
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
      <div class="wrap article-head">
        <div class="crumbs">
          <a href={`${ctx.base}/blog`}>Journal</a>
        </div>
        <h1>{post.title}</h1>
        <div class="article-meta">
          {dateLong(post.publishedAt ?? post.createdAt)}
          {post.writer?.name ?? post.author?.name ? <span>{post.writer?.name ?? post.author?.name}</span> : null}
        </div>
      </div>
      {post.coverImage ? <img class="article-cover" src={post.coverImage} alt="" /> : null}
      <div class="wrap article-body">
        <article class="prose lead narrow" style="padding-top:clamp(36px,5vw,56px)">
          {raw(safeHtml(post.content))}
        </article>
        {post.writer?.name && post.writer?.bio ? (
          <div class="narrow" style="margin-top:56px;border-top:1px solid var(--line);padding-top:20px">
            <strong>{post.writer.name}</strong>
            <p class="muted" style="margin-top:6px">{post.writer.bio}</p>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

export function InfoPage({ ctx, page }: { ctx: Ctx; page: Record<string, any> }) {
  return (
    <Layout ctx={ctx} title={page.metaTitle || page.title} description={page.metaDescription || plain(page.content, 160)} image={page.coverImage}>
      <div class="wrap article-head">
        <h1>{page.title}</h1>
      </div>
      {page.coverImage ? <img class="article-cover" src={page.coverImage} alt="" /> : null}
      <div class="wrap article-body">
        <article class="prose narrow" style="padding-top:clamp(36px,5vw,56px)">{raw(safeHtml(page.content))}</article>
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
      <div class="wrap" style="padding-bottom:clamp(64px,9vw,128px)">
        <div class="two" style="align-items:start">
          <div>
            <Flash sent={flash.sent} error={flash.error} />
            <EnquiryForm base={ctx.base} back={`${ctx.base}/contact`} />
          </div>
          <div class="muted" style="font-size:1.05rem;border-top:1px solid var(--ink);padding-top:22px">
            <div class="kicker">Reach us</div>
            {company.email ? <p style="margin-top:16px">{company.email}</p> : null}
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>
          {raw(
            "body{margin:0;font-family:'Archivo',ui-sans-serif,system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100svh;padding:24px;color:#222b2e;background:#f4f3ef}main{max-width:620px}h1{font-family:'Anton','Arial Narrow',Impact,sans-serif;font-weight:400;text-transform:uppercase;font-size:clamp(2.6rem,7vw,4.6rem);line-height:.95;letter-spacing:.005em;margin:0 0 20px}p{color:#687174;line-height:1.65;font-size:1.1rem;margin:0}a{display:inline-block;margin-top:32px;background:#222b2e;color:#fff;border-radius:999px;padding:14px 26px;text-decoration:none;font-weight:600;font-size:14px}",
          )}
        </style>
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
