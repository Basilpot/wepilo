/** One stylesheet for the whole site. Big type, plenty of air, black and white with soft warm tints. */
export const css = `
:root{--ink:#0b0b0b;--muted:#66645f;--line:#e7e5df;--paper:#fff;--tint:#f5f4ef;--radius:22px;--wrap:1240px}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,h3,h4{margin:0;letter-spacing:-0.03em;line-height:1.05;font-weight:600;text-wrap:balance}
p{margin:0}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 32px}
.muted{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* header */
.announce{background:var(--ink);color:#fff;text-align:center;font-size:14px;padding:10px 16px}
.announce a{text-underline-offset:3px}
header.site{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.88);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid transparent}
header.site .bar{display:flex;align-items:center;justify-content:space-between;height:76px;gap:24px}
.brand{font-size:21px;font-weight:700;letter-spacing:-0.04em;text-decoration:none;display:flex;align-items:center;gap:10px}
.brand img{height:34px;width:auto}
nav.main{display:flex;align-items:center;gap:6px}
nav.main>ul{display:flex;gap:2px;list-style:none;margin:0;padding:0}
nav.main li{position:relative}
nav.main a.top{display:block;padding:10px 14px;border-radius:999px;font-size:15px;text-decoration:none;color:#2b2a27}
nav.main a.top:hover{background:var(--tint)}
nav.main ul.sub{position:absolute;left:0;top:100%;min-width:220px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:8px;list-style:none;margin:6px 0 0;display:none;box-shadow:0 18px 50px -20px rgba(0,0,0,.25)}
nav.main li:hover>ul.sub,nav.main li:focus-within>ul.sub{display:block}
nav.main ul.sub a{display:block;padding:9px 12px;border-radius:12px;font-size:15px;text-decoration:none}
nav.main ul.sub a:hover{background:var(--tint)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--ink);color:#fff;border:0;border-radius:999px;padding:14px 26px;font:inherit;font-weight:600;font-size:16px;text-decoration:none;cursor:pointer;transition:transform .15s,opacity .15s}
.btn:hover{opacity:.86}
.btn.sm{padding:10px 20px;font-size:15px}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--ink)}
.btn.light{background:#fff;color:var(--ink)}
details.menu{display:none}

/* hero */
.hero{padding:88px 0 40px}
.hero h1{font-size:clamp(3.2rem,9vw,7.2rem);line-height:.95;letter-spacing:-0.055em;max-width:14ch}
.hero p.sub{margin-top:28px;font-size:clamp(1.15rem,2vw,1.5rem);color:var(--muted);max-width:34ch;line-height:1.4}
.hero .actions{margin-top:36px;display:flex;gap:12px;flex-wrap:wrap}
.hero figure{margin:64px 0 0}
.hero figure img{width:100%;aspect-ratio:21/9;object-fit:cover;border-radius:32px;background:var(--tint)}

/* sections */
section.block{padding:104px 0}
section.block.tint{background:var(--tint)}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:48px}
.head h2{font-size:clamp(2.1rem,5vw,3.8rem);max-width:16ch}
.head p{margin-top:14px;color:var(--muted);max-width:52ch}
.link{font-weight:600;text-underline-offset:4px;white-space:nowrap}
.grid{display:grid;gap:32px 28px;grid-template-columns:repeat(auto-fill,minmax(310px,1fr))}
.card{text-decoration:none;display:block}
.card .ph{aspect-ratio:4/3;border-radius:var(--radius);overflow:hidden;background:var(--tint)}
.card .ph img{width:100%;height:100%;object-fit:cover;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.card:hover .ph img{transform:scale(1.04)}
.card h3{font-size:22px;letter-spacing:-0.025em;margin-top:18px;line-height:1.2}
.card .meta{margin-top:8px;color:var(--muted);font-size:15px;display:flex;gap:10px;flex-wrap:wrap}
.card .price{margin-top:10px;font-weight:600}
.ph.empty{display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:700;color:#bdbab1;letter-spacing:-0.04em}
.tiles{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.tile{position:relative;aspect-ratio:4/5;border-radius:var(--radius);overflow:hidden;display:block;background:var(--tint);text-decoration:none;color:#fff}
.tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tile::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.62))}
.tile span{position:absolute;left:22px;bottom:20px;z-index:1;font-size:26px;font-weight:600;letter-spacing:-0.03em}
.tile.plain{color:var(--ink)}
.tile.plain::after{display:none}
.pills{display:flex;flex-wrap:wrap;gap:12px}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:12px 22px;text-decoration:none;font-size:17px;background:#fff}
.pill:hover,.pill.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.quotes{display:grid;gap:28px;grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
.quote{background:#fff;border-radius:var(--radius);padding:36px}
.quote p.q{font-size:22px;line-height:1.4;letter-spacing:-0.02em}
.quote .by{margin-top:26px;display:flex;align-items:center;gap:12px;color:var(--muted);font-size:15px}
.quote .by img{width:44px;height:44px;border-radius:50%;object-fit:cover}
.stars{color:var(--ink);letter-spacing:2px;font-size:15px}
.panel{background:var(--ink);color:#fff;border-radius:36px;padding:84px 56px;text-align:center}
.panel h2{font-size:clamp(2rem,5vw,3.6rem);max-width:18ch;margin:0 auto}
.panel p{color:#bdbab1;margin:18px auto 0;max-width:46ch}
.signup{margin:36px auto 0;display:flex;gap:10px;max-width:460px;flex-wrap:wrap;justify-content:center}
.signup input{flex:1;min-width:220px}
.two{display:grid;gap:64px;grid-template-columns:1.1fr 1fr;align-items:center}
.two img{width:100%;border-radius:var(--radius);aspect-ratio:4/5;object-fit:cover}
.prose{max-width:70ch;font-size:18px}
.prose>*+*{margin-top:1.1em}
.prose h2{font-size:2rem;margin-top:1.8em}
.prose h3{font-size:1.4rem;margin-top:1.6em}
.prose ul,.prose ol{padding-left:1.3em}
.prose li+li{margin-top:.4em}
.prose img{border-radius:16px;margin:1.6em 0}
.prose a{text-underline-offset:3px}
.prose blockquote{margin-left:0;padding-left:20px;border-left:3px solid var(--ink);color:var(--muted)}

/* trips */
.page-head{padding:72px 0 32px}
.page-head h1{font-size:clamp(2.6rem,7vw,5.2rem);letter-spacing:-0.05em;line-height:.98}
.page-head p{margin-top:20px;color:var(--muted);font-size:1.2rem;max-width:52ch}
.crumbs{font-size:14px;color:var(--muted);margin-bottom:22px}
.crumbs a{text-underline-offset:3px}
.gallery{display:grid;gap:12px;grid-template-columns:2fr 1fr 1fr;grid-template-rows:230px 230px;margin-top:36px}
.gallery img{width:100%;height:100%;object-fit:cover;border-radius:18px;background:var(--tint)}
.gallery img:first-child{grid-row:span 2;border-radius:var(--radius)}
.gallery.one{grid-template-columns:1fr;grid-template-rows:520px}
.facts{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
.fact{border:1px solid var(--line);border-radius:999px;padding:8px 16px;font-size:15px}
.detail{display:grid;gap:72px;grid-template-columns:minmax(0,1fr) 380px;margin-top:64px;align-items:start}
.sticky{position:sticky;top:104px;border:1px solid var(--line);border-radius:26px;padding:30px;background:#fff}
.sticky .from{color:var(--muted);font-size:14px}
.sticky .amt{font-size:40px;letter-spacing:-0.04em;font-weight:600;line-height:1.1}
.dep{margin-top:22px;border-top:1px solid var(--line);padding-top:18px;font-size:15px}
.dep div{display:flex;justify-content:space-between;padding:6px 0}
.block2{padding:40px 0;border-top:1px solid var(--line)}
.block2:first-child{border-top:0;padding-top:0}
.block2>h2{font-size:2rem;margin-bottom:22px}
details.acc{border-top:1px solid var(--line)}
details.acc:last-child{border-bottom:1px solid var(--line)}
details.acc summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;font-size:20px;font-weight:600;letter-spacing:-0.02em}
details.acc summary::-webkit-details-marker{display:none}
details.acc summary::after{content:"+";font-size:26px;font-weight:300}
details.acc[open] summary::after{content:"–"}
details.acc .in{padding:0 0 26px;color:#33322e}
.cols{display:grid;gap:40px;grid-template-columns:1fr 1fr}
.ticks{list-style:none;margin:0;padding:0}
.ticks li{padding:8px 0 8px 28px;position:relative}
.ticks li::before{content:"✓";position:absolute;left:0;font-weight:700}
.ticks.no li::before{content:"×"}
.review{border:1px solid var(--line);border-radius:var(--radius);padding:26px}
.review .imgs{display:flex;gap:8px;margin-top:14px}
.review .imgs img{width:72px;height:72px;object-fit:cover;border-radius:12px}

/* forms */
form.stack{display:grid;gap:16px}
label.f{display:grid;gap:8px;font-size:15px;font-weight:600}
input,textarea{font:inherit;border:1px solid #cfcdc6;border-radius:14px;padding:14px 16px;background:#fff;color:var(--ink);width:100%}
input:focus,textarea:focus{outline:2px solid var(--ink);outline-offset:1px}
.panel input{border-radius:999px;border-color:#fff}
.flash{border-radius:16px;padding:16px 20px;margin-bottom:24px;font-size:16px}
.flash.ok{background:#ecf6ee;color:#14532d}
.flash.err{background:#fdeeee;color:#7f1d1d}
.note{border:1px dashed var(--line);border-radius:var(--radius);padding:56px 28px;text-align:center;color:var(--muted)}

/* footer */
footer.site{background:var(--tint);padding:84px 0 40px;margin-top:40px}
.fgrid{display:grid;gap:48px;grid-template-columns:1.4fr repeat(auto-fit,minmax(150px,1fr))}
footer.site h4{font-size:15px;letter-spacing:0;margin-bottom:16px}
footer.site ul{list-style:none;margin:0;padding:0;display:grid;gap:10px;font-size:15px}
footer.site a{text-decoration:none}
footer.site a:hover{text-decoration:underline}
.fbrand{font-size:26px;font-weight:700;letter-spacing:-0.04em}
.fbottom{margin-top:64px;padding-top:24px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font-size:14px;color:var(--muted)}

@media (max-width:860px){
  .wrap{padding:0 20px}
  nav.main{display:none}
  details.menu{display:block;position:relative}
  details.menu summary{list-style:none;cursor:pointer;padding:10px 16px;border:1px solid var(--line);border-radius:999px;font-size:15px}
  details.menu summary::-webkit-details-marker{display:none}
  details.menu .sheet{position:absolute;right:0;top:52px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:10px;min-width:240px;box-shadow:0 18px 50px -20px rgba(0,0,0,.3)}
  details.menu .sheet a{display:block;padding:11px 14px;border-radius:12px;text-decoration:none}
  .hero{padding:56px 0 24px}
  section.block{padding:72px 0}
  .head{flex-direction:column;align-items:flex-start}
  .two,.cols,.detail{grid-template-columns:1fr}
  .detail{gap:40px}
  .sticky{position:static}
  .gallery{grid-template-columns:1fr 1fr;grid-template-rows:auto}
  .gallery img:first-child{grid-column:span 2;grid-row:auto;height:280px}
  .gallery img{height:150px}
  .panel{padding:56px 24px;border-radius:28px}
}
`;
