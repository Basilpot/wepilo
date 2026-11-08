/**
 * One stylesheet for the whole site. Editorial travel-magazine treatment: condensed uppercase
 * display type, full-bleed photography, hairline rules and a light warm paper.
 */
export const css = `
:root{
  --ink:#222b2e;--ink-2:#3b464a;--muted:#687174;--paper:#fff;--wash:#f4f3ef;--line:#dcdad2;--line-dark:#b9b7ad;
  --accent:#c8462b;--wrap:1440px;--gutter:clamp(20px,4vw,64px);--radius:2px;
  --display:"Anton","Arial Narrow",Impact,"Haettenschweiler",sans-serif;
  --sans:"Archivo",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,h3,h4{margin:0;line-height:1.08;font-weight:700;letter-spacing:-0.02em;text-wrap:balance}
p{margin:0}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 var(--gutter)}
.narrow{max-width:780px;margin:0 auto}
.muted{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.skip{position:absolute;left:16px;top:-64px;z-index:100;background:var(--ink);color:#fff;padding:12px 18px;text-decoration:none;font-size:13px}
.skip:focus{top:12px}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}

/* type helpers */
.kicker{font-size:11px;line-height:1.2;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.display{font-family:var(--display);font-weight:400;text-transform:uppercase;letter-spacing:.01em;line-height:.92}
.rule{border:0;border-top:1px solid var(--line);margin:0}

/* header */
.announce{background:var(--ink);color:#fff;text-align:center;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px}
.announce a{text-underline-offset:3px}
header.site{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.96);backdrop-filter:saturate(160%) blur(10px);border-bottom:1px solid var(--line)}
header.site .bar{display:flex;align-items:center;justify-content:space-between;height:74px;gap:32px}
.brand{font-family:var(--display);font-size:27px;line-height:1;letter-spacing:.015em;text-transform:uppercase;text-decoration:none;display:flex;align-items:center;gap:10px;white-space:nowrap}
.brand img{height:34px;width:auto}
nav.main{display:flex;align-items:center;gap:28px}
nav.main>ul{display:flex;gap:22px;list-style:none;margin:0;padding:0}
nav.main li{position:relative}
nav.main a.top{display:block;padding:8px 0;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink);border-bottom:2px solid transparent}
nav.main a.top:hover{border-bottom-color:var(--ink)}
nav.main ul.sub{position:absolute;left:-16px;top:100%;min-width:230px;background:#fff;border:1px solid var(--line);padding:8px;list-style:none;margin:8px 0 0;display:none;box-shadow:0 24px 50px -24px rgba(0,0,0,.3)}
nav.main li:hover>ul.sub,nav.main li:focus-within>ul.sub{display:block}
nav.main ul.sub a{display:block;padding:10px 12px;font-size:14px;text-decoration:none}
nav.main ul.sub a:hover{background:var(--wash)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--ink);color:#fff;border:1px solid var(--ink);border-radius:999px;padding:14px 26px;font:inherit;font-weight:600;font-size:14px;letter-spacing:.02em;text-decoration:none;cursor:pointer;transition:background .16s,border-color .16s,color .16s}
.btn:hover{background:var(--accent);border-color:var(--accent)}
.btn.sm{padding:10px 20px;font-size:13px}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--ink)}
.btn.ghost:hover{background:var(--ink);color:#fff}
.btn.light{background:#fff;color:var(--ink);border-color:#fff}
.btn.light:hover{background:var(--wash);border-color:var(--wash);color:var(--ink)}
details.menu{display:none;position:relative}

/* hero */
.hero{position:relative;display:grid;background:var(--wash);overflow:hidden}
.hero.has-image{min-height:min(82vh,820px);color:#fff}
.hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero.has-image::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.12) 0%,rgba(0,0,0,.05) 42%,rgba(0,0,0,.64) 100%)}
.hero-inner{position:relative;z-index:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end;padding-top:clamp(88px,14vh,180px);padding-bottom:clamp(48px,8vh,92px)}
.hero:not(.has-image) .hero-inner{justify-content:center;min-height:min(62vh,620px);padding-top:96px;padding-bottom:96px}
.hero h1{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(3.4rem,9.4vw,8.6rem);line-height:.88;letter-spacing:.005em;max-width:15ch;text-wrap:balance}
.hero p.sub{margin-top:24px;font-size:clamp(1.05rem,1.7vw,1.4rem);line-height:1.4;max-width:46ch;color:var(--muted)}
.hero.has-image p.sub{color:rgba(255,255,255,.86)}
.hero .actions{margin-top:32px;display:flex;gap:12px;flex-wrap:wrap}
.hero .actions .btn.light{background:#fff;color:var(--ink)}

/* sections */
section.block{padding:clamp(64px,9vw,128px) 0}
section.block.tint{background:var(--wash)}
section.block.ink{background:var(--ink);color:#fff}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;border-top:1px solid var(--ink);padding-top:22px;margin-bottom:clamp(32px,5vw,56px)}
.head h2{font-size:clamp(2rem,4.4vw,3.1rem);line-height:1.02;letter-spacing:-.025em;max-width:18ch}
.head p{margin-top:14px;color:var(--muted);max-width:54ch;font-size:1.05rem}
.head .more{flex:none;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;border-bottom:1px solid var(--ink);padding-bottom:4px;white-space:nowrap}
.head .more:hover{color:var(--accent);border-color:var(--accent)}
.ink .head{border-color:rgba(255,255,255,.35)}
.ink .head p,.ink .kicker{color:rgba(255,255,255,.66)}
.ink .head .more{border-color:#fff}
.grid{display:grid;gap:clamp(28px,3.4vw,44px) clamp(18px,2.2vw,28px);grid-template-columns:repeat(3,minmax(0,1fr))}
.card{text-decoration:none;display:block}
.card .ph{aspect-ratio:3/4;overflow:hidden;background:var(--wash);border-radius:var(--radius)}
.card .ph img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.card:hover .ph img{transform:scale(1.03)}
.card h3{font-size:clamp(1.25rem,1.7vw,1.6rem);line-height:1.14;margin-top:18px;letter-spacing:-.02em}
.card .meta{margin-top:10px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
.card .meta span+span::before{content:"/";margin-right:12px;color:var(--line-dark)}
.card .price{margin-top:12px;font-weight:600;font-size:15px}
.ph.empty{display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:64px;color:#c6c2b7;letter-spacing:.02em}

/* lead story */
.feature{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(24px,3vw,48px);align-items:center;text-decoration:none}
.feature .ph{grid-column:span 7;aspect-ratio:4/3;overflow:hidden;background:var(--wash);border-radius:var(--radius)}
.feature .ph img{width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
.feature:hover .ph img{transform:scale(1.025)}
.feature .body{grid-column:span 5}
.feature h3{font-size:clamp(2rem,3.4vw,3.2rem);line-height:1.02;letter-spacing:-.03em;margin-top:14px;max-width:18ch}
.feature .dek{margin-top:18px;color:var(--muted);font-size:1.05rem;line-height:1.6;max-width:44ch}
.feature .meta{margin-top:22px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
.feature .meta span+span::before{content:"/";margin-right:12px;color:var(--line-dark)}
.feature .price{margin-top:18px;font-weight:600}
.feature .go{margin-top:26px;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid var(--ink);padding-bottom:4px}

/* destinations */
.mosaic{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tile{position:relative;aspect-ratio:4/5;overflow:hidden;display:block;background:var(--wash);text-decoration:none;color:#fff;border-radius:var(--radius)}
.tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
.tile:hover img{transform:scale(1.04)}
.tile::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 42%,rgba(0,0,0,.66) 100%)}
.tile .label{position:absolute;left:20px;right:20px;bottom:18px;z-index:1}
.tile .label b{display:block;font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(1.4rem,2.4vw,2.4rem);line-height:.98;letter-spacing:.01em}
.tile .label small{display:block;margin-top:6px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.82}
.tile.plain{color:var(--ink);background:var(--wash);border:1px solid var(--line)}
.tile.plain::after{display:none}
.tile.plain .label small{color:var(--muted);opacity:1}

/* topics */
.topics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 clamp(32px,5vw,72px)}
.topic{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0;border-bottom:1px solid var(--line);text-decoration:none}
.topic span{font-size:clamp(1.35rem,2.4vw,2rem);font-weight:600;letter-spacing:-.02em;line-height:1.1}
.topic small{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.topic:hover span{color:var(--accent)}
.topic:hover small{color:var(--accent)}

/* quotes */
.quotes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 clamp(32px,5vw,72px)}
.quote{margin:0;padding:28px 0;border-top:1px solid rgba(255,255,255,.28)}
.quote p.q{font-size:clamp(1.3rem,2vw,1.7rem);line-height:1.4;letter-spacing:-.015em;color:#fff}
.quote:first-child{grid-column:1/-1;border-top:0;padding-top:0}
.quote:first-child p.q{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(2rem,4.4vw,3.6rem);line-height:1.02;letter-spacing:.005em;max-width:24ch}
.quote .by{margin-top:20px;display:flex;align-items:center;gap:12px;color:rgba(255,255,255,.62);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.quote .by img{width:40px;height:40px;border-radius:50%;object-fit:cover}

/* journal */
.post-feature{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(24px,3vw,48px);align-items:center;text-decoration:none}
.post-feature .ph{grid-column:span 7;aspect-ratio:16/10;overflow:hidden;background:var(--wash)}
.post-feature .ph img{width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
.post-feature:hover .ph img{transform:scale(1.025)}
.post-feature .body{grid-column:span 5}
.post-feature h3{font-size:clamp(1.9rem,3.2vw,3rem);line-height:1.04;letter-spacing:-.03em;margin-top:14px;max-width:20ch}
.post-feature .dek{margin-top:16px;color:var(--muted);font-size:1.02rem;max-width:42ch}
.post-feature .meta{margin-top:20px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.post-list{margin-top:clamp(36px,5vw,64px);border-top:1px solid var(--line)}
.post-row{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:clamp(20px,3vw,40px);align-items:center;padding:26px 0;border-bottom:1px solid var(--line);text-decoration:none}
.post-row .meta{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.post-row h3{font-size:clamp(1.35rem,2vw,1.75rem);line-height:1.15;margin-top:8px;letter-spacing:-.02em}
.post-row .dek{margin-top:8px;color:var(--muted);font-size:.98rem;max-width:60ch}
.post-row .ph{aspect-ratio:3/2;overflow:hidden;background:var(--wash)}
.post-row .ph img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.post-row:hover .ph img{transform:scale(1.03)}
.post-row:hover h3{color:var(--accent)}

/* newsletter */
.newsletter .panel{background:var(--ink);color:#fff;padding:clamp(48px,7vw,96px) clamp(24px,5vw,72px)}
.newsletter h2{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(2.4rem,5.4vw,4.6rem);line-height:.94;letter-spacing:.005em;max-width:18ch}
.newsletter p{color:rgba(255,255,255,.65);margin-top:18px;max-width:46ch}
.signup{margin-top:36px;display:flex;gap:12px;max-width:560px;flex-wrap:wrap}
.signup input{flex:1;min-width:220px;background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.55);border-radius:0;color:#fff;padding:14px 2px;font-size:16px}
.signup input::placeholder{color:rgba(255,255,255,.5)}
.signup input:focus{outline:0;border-bottom-color:#fff}

/* editorial split */
.two{display:grid;gap:clamp(32px,5vw,72px);grid-template-columns:1.05fr .95fr;align-items:center}
.two img{width:100%;aspect-ratio:4/5;object-fit:cover}
.split-title{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(2.2rem,5vw,4.2rem);line-height:.94;max-width:16ch;margin-bottom:22px}

/* prose */
.prose{max-width:70ch;font-size:18px;line-height:1.72}
.prose>*+*{margin-top:1.15em}
.prose h2{font-size:clamp(1.8rem,3vw,2.5rem);line-height:1.05;margin-top:1.8em;letter-spacing:-.025em}
.prose h3{font-size:1.45rem;margin-top:1.6em}
.prose ul,.prose ol{padding-left:1.25em}
.prose li+li{margin-top:.45em}
.prose img{margin:1.8em 0}
.prose a{text-underline-offset:3px}
.prose blockquote{margin:1.8em 0;padding-left:24px;border-left:2px solid var(--ink);font-size:1.3em;line-height:1.45;color:var(--ink-2)}
.prose.lead>p:first-of-type::first-letter{float:left;font-family:var(--display);font-size:4.6em;line-height:.78;padding:.06em .1em 0 0;text-transform:uppercase}

/* listing page */
.page-head{padding:clamp(48px,7vw,88px) 0 clamp(24px,4vw,40px)}
.page-head h1{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(3rem,8vw,6.4rem);line-height:.9;letter-spacing:.005em;max-width:18ch}
.page-head p{margin-top:20px;color:var(--muted);font-size:1.15rem;max-width:54ch}
.filters{display:flex;flex-wrap:wrap;gap:4px 26px;margin-top:32px;border-bottom:1px solid var(--line)}
.filter{display:inline-block;padding:14px 0;font-size:11px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;text-decoration:none;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.filter:hover{color:var(--ink)}
.filter.on{color:var(--ink);border-bottom-color:var(--ink)}
.grid.trips{margin-top:clamp(36px,5vw,56px)}
.crumbs{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:20px}
.crumbs a{text-underline-offset:3px}
.crumbs a:hover{color:var(--ink)}

/* trip detail */
.trip-head{padding-top:clamp(36px,5vw,64px);padding-bottom:clamp(24px,3vw,36px)}
.trip-title{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(2.9rem,7.4vw,6.4rem);line-height:.9;letter-spacing:.005em;max-width:18ch}
.facts{display:flex;gap:8px 22px;flex-wrap:wrap;margin-top:26px;padding-top:20px;border-top:1px solid var(--line);font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
.fact{display:inline-flex;align-items:center;gap:8px}
.fact+.fact::before{content:"/";color:var(--line-dark);margin-right:14px}
.fact .stars{letter-spacing:1px;color:var(--ink)}
.gallery{display:grid;gap:10px;grid-template-columns:2fr 1fr;grid-template-rows:minmax(300px,52vh) minmax(180px,26vh);margin:0}
.gallery img{width:100%;height:100%;object-fit:cover;background:var(--wash)}
.gallery img:first-child{grid-row:span 2}
.gallery.one{grid-template-columns:1fr;grid-template-rows:minmax(360px,66vh)}
.gallery.one img:first-child{grid-row:auto}
.gallery.two{grid-template-columns:1fr 1fr;grid-template-rows:minmax(360px,60vh)}
.gallery.two img:first-child{grid-row:auto}
.detail{display:grid;gap:clamp(40px,6vw,80px);grid-template-columns:minmax(0,1fr) 360px;margin-top:clamp(48px,7vw,88px);align-items:start}
.sticky{position:sticky;top:104px;border:1px solid var(--ink);padding:28px;background:var(--paper)}
.sticky .from{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.sticky .amt{font-family:var(--display);font-size:clamp(2.6rem,4vw,3.4rem);line-height:1;letter-spacing:.01em;margin:6px 0 2px}
.sticky .amt .muted{font-family:var(--sans);font-size:18px;letter-spacing:-.02em}
.dep{margin-top:24px;border-top:1px solid var(--line);padding-top:18px;font-size:14px}
.dep strong{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
.dep div{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)}
.dep div:last-child{border-bottom:0}
.block2{padding:clamp(32px,4vw,48px) 0;border-top:1px solid var(--line)}
.block2:first-child{border-top:0;padding-top:0}
.block2>h2{font-size:clamp(1.8rem,3vw,2.5rem);line-height:1.05;letter-spacing:-.025em;margin-bottom:22px}
details.acc{border-top:1px solid var(--line)}
details.acc:last-child{border-bottom:1px solid var(--line)}
details.acc summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;font-size:clamp(1.1rem,1.6vw,1.35rem);font-weight:600;letter-spacing:-.015em}
details.acc summary::-webkit-details-marker{display:none}
details.acc summary::after{content:"+";font-size:26px;font-weight:300;line-height:1}
details.acc[open] summary::after{content:"–"}
details.acc .in{padding:0 0 28px;color:var(--ink-2)}
.cols{display:grid;gap:clamp(28px,4vw,56px);grid-template-columns:1fr 1fr}
.review{border-top:1px solid var(--line);padding:24px 0}
.review .imgs{display:flex;gap:8px;margin-top:14px}
.review .imgs img{width:76px;height:76px;object-fit:cover}
.review .stars{color:var(--ink);letter-spacing:2px}
.enquiry{background:var(--wash);padding:clamp(56px,8vw,104px) 0;margin-top:clamp(56px,8vw,96px)}
.enquiry h2{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(2.2rem,4.6vw,3.8rem);line-height:.94;max-width:16ch}
.enquiry .two{grid-template-columns:1fr 1fr;align-items:start}
.enquiry .two>div>p{margin-top:16px;max-width:40ch;color:var(--muted)}

/* journal article */
.article-cover{width:100%;height:min(66vh,640px);object-fit:cover;background:var(--wash)}
.article-head{padding:clamp(40px,6vw,72px) 0 clamp(24px,3vw,36px)}
.article-head h1{font-family:var(--display);font-weight:400;text-transform:uppercase;font-size:clamp(2.8rem,6.6vw,5.8rem);line-height:.92;letter-spacing:.005em;max-width:20ch}
.article-meta{margin-top:22px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap}
.article-body{padding-bottom:clamp(56px,8vw,96px)}
.article-body .prose{font-size:19px}

/* forms */
form.stack{display:grid;gap:18px}
label.f{display:grid;gap:8px;font-size:10px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
input,textarea{font:inherit;font-size:16px;border:1px solid var(--line-dark);border-radius:var(--radius);padding:14px 16px;background:var(--paper);color:var(--ink);width:100%}
input:focus,textarea:focus{outline:2px solid var(--ink);outline-offset:1px}
label.f input,label.f textarea{color:var(--ink);letter-spacing:normal;text-transform:none;font-weight:400}
.flash{border-left:3px solid var(--ink);background:var(--wash);padding:16px 20px;margin-bottom:24px;font-size:15px}
.flash.ok{border-color:#1f7a43}
.flash.err{border-color:#a1281c}
.note{border:1px solid var(--line);padding:56px 28px;text-align:center;color:var(--muted)}

/* footer */
footer.site{background:var(--ink);color:#fff;padding:clamp(64px,8vw,104px) 0 36px;margin-top:0}
.fgrid{display:grid;gap:48px;grid-template-columns:1.6fr repeat(auto-fit,minmax(150px,1fr))}
.fbrand{font-family:var(--display);font-size:clamp(2rem,3vw,2.8rem);line-height:1;letter-spacing:.01em;text-transform:uppercase}
footer.site p{color:rgba(255,255,255,.58)}
footer.site h4{font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px;color:rgba(255,255,255,.55)}
footer.site ul{list-style:none;margin:0;padding:0;display:grid;gap:10px;font-size:14px}
footer.site a{text-decoration:none}
footer.site a:hover{text-decoration:underline;text-underline-offset:3px}
.fbottom{margin-top:clamp(48px,6vw,72px);padding-top:22px;border-top:1px solid rgba(255,255,255,.2);display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.48)}

@media (max-width:1100px){
  .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .feature,.post-feature{grid-template-columns:1fr;gap:28px}
  .feature .ph,.feature .body,.post-feature .ph,.post-feature .body{grid-column:auto}
  .feature .ph,.post-feature .ph{aspect-ratio:16/10}
  .detail{grid-template-columns:minmax(0,1fr) 320px}
}
@media (max-width:900px){
  nav.main{display:none}
  details.menu{display:block}
  details.menu summary{list-style:none;cursor:pointer;padding:10px 18px;border:1px solid var(--ink);border-radius:999px;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
  details.menu summary::-webkit-details-marker{display:none}
  details.menu .sheet{position:absolute;right:0;top:52px;background:#fff;border:1px solid var(--line);padding:10px;min-width:260px;box-shadow:0 24px 50px -24px rgba(0,0,0,.35)}
  details.menu .sheet a{display:block;padding:12px 14px;text-decoration:none;font-size:15px}
  details.menu .sheet a:hover{background:var(--wash)}
  .mosaic{grid-template-columns:repeat(2,minmax(0,1fr))}
  .topics{grid-template-columns:1fr}
  .detail{grid-template-columns:1fr;gap:40px}
  .sticky{position:static}
  .enquiry .two{grid-template-columns:1fr}
  .gallery,.gallery.two{grid-template-columns:1fr 1fr;grid-template-rows:auto}
  .gallery.one{grid-template-columns:1fr}
  .gallery img:first-child{grid-column:span 2;grid-row:auto;height:min(56vh,460px)}
  .gallery.one img:first-child{grid-column:auto}
  .gallery img{height:180px}
}
@media (max-width:700px){
  body{font-size:16px}
  .grid{grid-template-columns:1fr}
  .card .ph{aspect-ratio:4/3}
  .quotes{grid-template-columns:1fr}
  .quote:first-child{grid-column:auto}
  .post-row{grid-template-columns:1fr}
  .post-row .ph{display:none}
  .fgrid{grid-template-columns:1fr 1fr}
  .fgrid>div:first-child{grid-column:1/-1}
  .gallery,.gallery.two{grid-template-columns:1fr}
  .gallery img:first-child{grid-column:auto;height:min(52vh,420px)}
  .gallery img{height:220px}
  .hero.has-image{min-height:min(76vh,640px)}
  .hero h1{font-size:clamp(3rem,15vw,5.2rem)}
  .feature h3,.post-feature h3{font-size:clamp(1.8rem,7vw,2.4rem)}
  .two{grid-template-columns:1fr}
  .two img{aspect-ratio:4/3}
  .cols{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .card .ph img,.feature .ph img,.post-feature .ph img,.post-row .ph img,.tile img{transition:none}
  .card:hover .ph img,.feature:hover .ph img,.post-feature:hover .ph img,.post-row:hover .ph img,.tile:hover img{transform:none}
}
`;
