/** CSS próprio da landing (soma-se ao `hudCss`). Imagens estáticas e animação só de CSS: nada de WebGL nem laço por frame. */
export const LANDING_CSS = `
.section{overflow-x:clip}
.foot-note{margin:22px 0 0;font-size:15px;color:var(--faint)}
.foot-note a,.faq a{color:var(--amber)}
/* ---------- abertura: a foto é o protagonista ---------- */
.hero{position:relative;isolation:isolate;overflow:hidden;min-height:clamp(660px,56vw,820px);display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}
.hero-stage{position:absolute;right:0;top:0;z-index:-2;height:100%;aspect-ratio:2/1;transition:transform .35s ease-out}
.hero-art{display:block;width:100%;height:100%;object-fit:cover}
.hero-shade{position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,var(--bg) 0,rgba(9,11,15,.93) 20%,rgba(9,11,15,.55) 42%,transparent 66%),linear-gradient(0deg,var(--bg) 0,transparent 28%),linear-gradient(180deg,rgba(9,11,15,.55),transparent 18%)}
.dim{position:absolute;width:0;border-left:1px solid var(--amber);pointer-events:none}
.dim::before,.dim::after{content:'';position:absolute;left:-6px;width:12px;height:1px;background:var(--amber)}
.dim::before{top:0}.dim::after{bottom:0}
.dim i{position:absolute;top:50%;padding:3px 9px;background:rgba(9,11,15,.78);font:700 15px/1.2 var(--fh);font-style:normal;letter-spacing:.1em;color:var(--amber);transform:translateY(-50%);white-space:nowrap}
.dim-r i{left:auto;right:-3px;top:-34px;transform:none}.dim-l i{right:10px}
.spec-tag{position:absolute;right:max(40px,calc((100vw - 1280px)/2 + 40px));top:112px;margin:0;padding-left:16px;border-left:3px solid var(--amber);font:600 13px/1.4 var(--fh);letter-spacing:.12em;text-transform:uppercase;color:var(--text);white-space:nowrap}
.spec-tag b{display:block;font:italic 700 21px/1.15 var(--fh);letter-spacing:.04em;color:#fff}
.hero-in{position:relative;padding-top:74px;padding-bottom:170px}
.hero-copy{max-width:760px;min-width:0}
.hero-eyebrow{margin-bottom:22px}
.hero h1{margin:0}
.hero h1 .t1{display:inline-block;white-space:nowrap;padding-right:.08em;font:italic 700 clamp(56px,8.8vw,138px)/.84 var(--fh);letter-spacing:-.018em;text-transform:uppercase;background:linear-gradient(180deg,#fff 0,#f4f4f1 50%,#a2aab2 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 8px 26px rgba(0,0,0,.7))}
.hero h1 .t2{display:flex;align-items:center;gap:.3em;margin-top:.1em;font:italic 700 clamp(34px,5.4vw,84px)/1 var(--fh);letter-spacing:.02em;text-transform:uppercase;color:var(--amber);filter:drop-shadow(0 0 24px rgba(255,170,0,.25))}
.hero h1 .t2::after{content:'';flex:0 1 190px;height:.2em;margin-top:.14em;background:linear-gradient(90deg,var(--amber),rgba(255,208,0,.2));clip-path:polygon(0 0,100% 0,88% 100%,8% 100%)}
.hero-lead{max-width:44ch;margin:30px 0 40px;font-size:20px;line-height:1.6;color:#e5e9ec}
.hero-bar{position:absolute;left:0;right:0;bottom:0;border-top:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(9,11,15,.5),rgba(9,11,15,.94));backdrop-filter:blur(6px)}
.hero-bar .container{position:relative}
.hero-bar ul{display:flex;list-style:none;margin:0;padding:0}
.hero-bar li{display:flex;align-items:center;gap:16px;padding:24px 38px 24px 0;margin-right:38px;border-right:1px solid rgba(255,255,255,.12);font:400 15px/1.35 var(--fb);color:var(--muted)}
.hero-bar li:last-child{border:0}
.hero-bar li b{display:block;font:700 15px/1.3 var(--fh);letter-spacing:.14em;text-transform:uppercase;color:var(--bone)}
.hero-bar li .ico{color:var(--amber);stroke-width:1.4}
.art-note{position:absolute;right:40px;bottom:12px;font:600 11.5px/1 var(--fh);letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.home .hnav .nav-play{opacity:0;pointer-events:none;transform:translateY(-8px)}
.home.past-hero .hnav .nav-play{opacity:1;pointer-events:auto;transform:none}
.nav-play{transition:opacity .3s,transform .3s,filter .18s}
/* ---------- gameplay: palco grande e seletor com o que cada câmera faz ---------- */
.gp{display:grid;grid-template-columns:1.6fr 1fr;gap:36px;align-items:stretch}
.gp-stage{position:relative;margin:0;background:#000;border:1px solid rgba(255,255,255,.1);clip-path:polygon(0 0,calc(100% - 30px) 0,100% 30px,100% 100%,0 100%);min-width:0}
.gp-stage::before{content:'';position:absolute;left:0;top:0;width:64px;height:5px;background:var(--amber);z-index:4}
.gp-slides{display:grid}
.camera-slide{grid-area:1/1;opacity:0;transition:opacity .8s ease;pointer-events:none}
.camera-slide.on{opacity:1}
.camera-slide img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
.gp-play{position:absolute;left:50%;top:46%;z-index:3;display:grid;place-items:center;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;border:2px solid var(--amber);background:rgba(9,11,15,.55);color:#fff;backdrop-filter:blur(3px);transition:transform .25s var(--ease),background .25s,color .25s}
.gp-play:hover{background:var(--amber);color:#090b0f;transform:scale(1.1)}
.gp-play .ico{margin-left:5px}
.gp-stage figcaption{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:64px 30px 24px;background:linear-gradient(0deg,rgba(9,11,15,.96),transparent)}
.gp-stage figcaption b{display:block;font:italic 700 26px/1.1 var(--fh);letter-spacing:.03em;text-transform:uppercase;color:#fff}
.gp-stage figcaption span{display:block;margin-top:6px;font-size:16px;color:var(--muted)}
.gp-tabs{display:flex;flex-direction:column;gap:14px;justify-content:center}
.gp-tabs button{position:relative;display:grid;grid-template-columns:44px 1fr;gap:20px;align-items:center;text-align:left;padding:24px 26px;background:var(--panel);border:1px solid rgba(255,255,255,.08);color:var(--muted);font:inherit;cursor:pointer;overflow:hidden;clip-path:polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,0 100%);transition:background .25s,border-color .25s}
.gp-tabs button .ico{stroke-width:1.3}
.gp-tabs button b{display:block;font:italic 700 21px/1.15 var(--fh);letter-spacing:.03em;text-transform:uppercase;color:var(--text)}
.gp-tabs button small{display:block;margin-top:5px;font:400 15.5px/1.45 var(--fb);color:var(--muted)}
.gp-tabs button:hover{border-color:rgba(255,208,0,.5)}
.gp-tabs button[aria-pressed=true]{background:linear-gradient(90deg,rgba(255,208,0,.13),var(--panel) 80%);border-color:var(--aline);color:var(--amber)}
.gp-tabs button[aria-pressed=true] b{color:#fff}
.gp-tabs .bar{position:absolute;left:0;bottom:0;height:3px;width:0;background:var(--amber)}
.gp-tabs button[aria-pressed=true].run:not(.still) .bar{animation:fill 6.5s linear forwards}
.gp-tabs button[aria-pressed=true].still .bar{width:100%}
@keyframes fill{to{width:100%}}
.gp-tabs .foot-note{margin:6px 0 0}
/* ---------- recursos: cartas altas, com recuo alternado ---------- */
.res-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;align-items:start}
.fcard{position:relative;aspect-ratio:3/4.3;overflow:hidden;background:#0d1217;clip-path:polygon(0 0,calc(100% - 28px) 0,100% 28px,100% 100%,0 100%)}
.fcard:nth-child(even){margin-top:54px}
.fcard img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(var(--z,1));transition:transform 1s var(--ease)}
.fcard:hover img{transform:scale(calc(var(--z,1) * 1.08))}
.fcard::before{content:'';position:absolute;left:0;top:0;width:44px;height:4px;background:var(--amber);z-index:3}
.fcard::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(9,11,15,.97) 0,rgba(9,11,15,.82) 38%,rgba(9,11,15,.1) 72%,rgba(9,11,15,.35));z-index:1}
.fnum{position:absolute;top:18px;right:20px;z-index:2;font:italic 700 66px/1 var(--fh);color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.5)}
.fbody{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:26px 26px 28px}
.fico{display:grid;place-items:center;width:52px;height:52px;border:2px solid var(--amber);background:rgba(9,11,15,.7);color:var(--amber);transition:background .25s,color .25s}
.fcard:hover .fico{background:var(--amber);color:#090b0f}
.fbody h3{margin:18px 0 10px;font:italic 700 26px/1.08 var(--fh);letter-spacing:.02em;text-transform:uppercase;color:#fff}
.fbody p{margin:0;font-size:16px;line-height:1.55;color:#cdd4da}
/* ---------- sem pay-to-win ---------- */
.ptw-sec{padding:50px 0}
.ptw{position:relative;display:grid;grid-template-columns:1fr 1.05fr;background:linear-gradient(105deg,#1c222a 0,#0f1318 60%);border:1px solid rgba(255,208,0,.35);clip-path:polygon(0 0,calc(100% - 44px) 0,100% 44px,100% 100%,44px 100%,0 calc(100% - 44px))}
.ptw::after{content:'';position:absolute;left:0;right:0;bottom:0;height:14px;background:repeating-linear-gradient(115deg,var(--amber) 0 16px,#0b0e12 16px 32px);opacity:.95}
.ptw-head{display:flex;flex-direction:column;justify-content:center;padding:64px 56px 70px;border-right:1px solid rgba(255,255,255,.08)}
.ptw-head .label{margin:0 0 18px;color:var(--text);opacity:.85}
.ptw-head .h2{font-size:clamp(44px,5.6vw,84px);line-height:.92}
.ptw-head .h2 em{display:block;white-space:nowrap}
.ptw-list{list-style:none;margin:0;padding:34px 48px 46px;display:grid;align-content:center}
.ptw-list li{display:grid;grid-template-columns:50px 1fr;gap:22px;align-items:start;padding:20px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.ptw-list li:last-child{border:0}
.ptw-ico{color:var(--amber)}.ptw-ico .ico{stroke-width:1.4}
.ptw-list h3{margin:0 0 5px;font:700 19px/1.3 var(--fh);color:var(--amber)}
.ptw-list p{margin:0;font-size:16px;line-height:1.55;color:var(--muted)}
/* ---------- hangar ---------- */
.hg-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:60px;align-items:center}
.hg-stage{position:relative;margin:0}
.hg-stage img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:cover;-webkit-mask-image:radial-gradient(ellipse 72% 72% at 50% 50%,#000 60%,transparent 100%);mask-image:radial-gradient(ellipse 72% 72% at 50% 50%,#000 60%,transparent 100%)}
.stage-cap{position:absolute;left:3%;bottom:4%;margin:0;padding-left:14px;border-left:3px solid var(--amber);font:600 14px/1.4 var(--fh);letter-spacing:.1em;text-transform:uppercase;color:var(--text)}
.stage-cap b{color:#fff}
.mk{position:absolute;display:grid;place-items:center;width:6.4%;aspect-ratio:1;min-width:30px;margin:0;padding:0;transform:translate(-50%,-50%) skewX(-8deg);border:2px solid var(--amber);background:rgba(9,11,15,.88);color:var(--amber);font:700 clamp(14px,1.7vw,20px)/1 var(--fh);cursor:pointer;z-index:2;transition:background .18s,color .18s,box-shadow .18s}
.mk.on,.mk:hover,.mk:focus-visible{background:var(--amber);color:#090b0f;box-shadow:0 0 26px rgba(255,208,0,.7);outline:0}
.hg-list{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.hg-list li{display:grid;grid-template-columns:48px 1fr;gap:20px;align-items:start;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08);transition:background .2s,padding-left .2s}
.hg-list li.on,.hg-list li:hover{background:linear-gradient(90deg,rgba(255,208,0,.14),transparent);padding-left:28px}
.hg-list .n{display:grid;place-items:center;width:40px;height:40px;border:2px solid var(--amber);transform:skewX(-8deg);font:700 18px var(--fh);color:var(--amber)}
.hg-list h3{margin:0 0 5px;font:700 18px/1.25 var(--fh);letter-spacing:.07em;text-transform:uppercase;color:var(--bone)}
.hg-list h3 span{margin-left:6px;color:var(--amber)}
.hg-list p{margin:0;font-size:16px;line-height:1.55;color:var(--muted)}
/* ---------- chassis na mesma régua ---------- */
.lineup{padding:100px 0 110px}
.lineup-photo{position:relative;margin:0 0 64px}
.lineup-photo img{display:block;width:100%;height:auto;aspect-ratio:3/1;object-fit:cover;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 16%,#000 84%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 16%,#000 84%,transparent 100%)}
.mtag{position:absolute;margin:0;transform:translateX(-50%);text-align:center;pointer-events:none;white-space:nowrap}
.mtag::before{content:'';display:block;width:1px;height:12px;margin:0 auto 6px;background:var(--amber)}
.mtag b{display:block;font:italic 700 20px/1.1 var(--fh);letter-spacing:.03em;text-transform:uppercase;color:#fff}
.mtag span{display:block;margin-top:3px;font:600 13px/1.2 var(--fh);letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.mtag.back{transform:translate(-50%,-100%)}.mtag.back::before{display:none}.mtag.back::after{content:'';display:block;width:1px;height:12px;margin:6px auto 0;background:var(--amber)}
.mtag.back b{color:var(--text);font-size:17px;opacity:.85}.mtag.back span{opacity:.8}
.mech-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.mech-card{display:flex;flex-direction:column;padding:30px 26px 28px;min-width:0;transition:transform .25s var(--ease),border-color .25s}
.mech-card:hover{transform:translateY(-4px);border-color:rgba(255,208,0,.5)}
.mech-card>.label{margin:0;color:var(--amber);font-size:12.5px;letter-spacing:.16em}
.mech-card h3{margin:12px 0 12px;white-space:nowrap;font:italic 700 clamp(22px,2.1vw,29px)/1 var(--fh);letter-spacing:.01em;text-transform:uppercase;color:var(--bone)}
.mech-card .desc{margin:0;font-size:16px;line-height:1.55;flex:1}
.mech-card>.label{min-height:2.7em}
.mech-card dl{display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;gap:12px;padding:20px 0;margin:20px 0;border-block:1px solid rgba(255,255,255,.1)}
.mech-card dt{font:600 12.5px/1.3 var(--fh);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.mech-card dd{margin:6px 0 0;font:italic 700 26px/1 var(--fh);color:var(--amber)}
/* ---------- arsenal ---------- */
.w-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.wcard{min-width:0;padding-bottom:18px;overflow:hidden}
.wcard header{position:relative}
.wcard header img{display:block;width:100%;height:auto;aspect-ratio:640/420;object-fit:cover;-webkit-mask-image:linear-gradient(180deg,#000 62%,transparent);mask-image:linear-gradient(180deg,#000 62%,transparent)}
.wcard header div{padding:0 26px;margin-top:-34px;position:relative}
.wcard h3{margin:0 0 6px;font:italic 700 24px/1.1 var(--fh);letter-spacing:.02em;text-transform:uppercase;color:#fff}
.wcard header .label{margin:0;font-size:12.5px;letter-spacing:.13em;color:var(--amber)}
.wcard table{width:calc(100% - 52px);margin:16px 26px 0;border-collapse:collapse;font-variant-numeric:tabular-nums}
.wcard th,.wcard td{padding:8px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,.07);font:600 16px/1.3 var(--fb)}
.wcard thead th{border:0;font:700 13px/1.3 var(--fh);letter-spacing:.14em;color:var(--amber);padding-bottom:8px}
.wcard tbody th{text-align:left;font:600 12.5px/1.3 var(--fh);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.wcard td{color:var(--bone)}
.wcard tr.big td{font:italic 700 26px/1.2 var(--fh);color:#fff}
.wcard tr:last-child th,.wcard tr:last-child td{border:0}
.wcard thead th:first-child{width:38%}
/* ---------- modos ---------- */
.mode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.mode-card{position:relative;overflow:hidden;background:var(--panel);clip-path:polygon(0 0,calc(100% - 28px) 0,100% 28px,100% 100%,0 100%);transition:transform .3s var(--ease)}
.mode-card:hover{transform:translateY(-5px)}
.mode-card::before{content:'';position:absolute;left:0;top:0;width:48px;height:4px;background:var(--amber);z-index:3}
.mode-card>img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;transition:transform .9s var(--ease)}
.mode-card:hover>img{transform:scale(1.05)}
.mode-body{position:relative;padding:26px 28px 30px;background:linear-gradient(180deg,#151b22,#10151b)}
.mode-body .label{margin:0;color:var(--amber);font-size:13px}
.mode-card h3{margin:10px 0 10px;font:italic 700 29px/1.08 var(--fh);letter-spacing:.01em;text-transform:uppercase;color:var(--bone)}
.mode-card .desc{margin:0 0 20px;font-size:16.5px;line-height:1.55;min-height:76px}
.mode-card .text-link{width:100%;justify-content:space-between;padding-top:18px;border-top:1px solid rgba(255,255,255,.1)}
/* ---------- esquadrão ---------- */
.squad-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.squad-grid li{position:relative;overflow:hidden;background:var(--panel);clip-path:polygon(0 0,calc(100% - 24px) 0,100% 24px,100% 100%,0 100%)}
.squad-grid li::before{content:'';position:absolute;left:0;top:0;width:44px;height:4px;background:var(--c);z-index:2}
.squad-grid img{display:block;width:100%;aspect-ratio:350/232;object-fit:cover;filter:saturate(1.1);transition:transform .9s var(--ease)}
.squad-grid li:hover img{transform:scale(1.06)}
.squad-grid div{position:relative;padding:20px 24px 24px;background:linear-gradient(180deg,#151b22,#10151b)}
.squad-grid h3{margin:0 0 6px;font:italic 700 30px/1 var(--fh);letter-spacing:.03em;text-transform:uppercase;color:var(--c)}
.squad-grid .label{margin:0;font-size:13px;color:var(--muted)}
.squad-cta{margin:38px 0 0}
/* ---------- primeira partida ---------- */
.brief-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:72px;align-items:center}
.brief-grid>div:first-child{display:grid;gap:30px;justify-items:start}
.brief-grid .sec-head{margin-bottom:0}
.control-grid{display:grid;grid-template-columns:repeat(2,1fr);margin:0;padding:12px 32px;gap:0 40px}
.control-grid>div{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);padding:22px 0;gap:10px}
.control-grid>div:nth-last-child(-n+2){border:0}
.control-grid dt{margin:0}
.control-grid kbd{display:inline-block;padding:8px 13px;border:1px solid rgba(255,208,0,.45);background:rgba(255,208,0,.07);font:700 14px/1 var(--fh);letter-spacing:.1em;text-transform:uppercase;color:var(--bone)}
.control-grid dd{margin:0;font:600 14px var(--fh);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
/* ---------- perguntas ---------- */
.narrow{max-width:980px}
.faq .sec-head{margin-bottom:34px}
.faq details{border-top:1px solid rgba(255,255,255,.1);padding:24px 0}.faq details:last-child{border-bottom:1px solid rgba(255,255,255,.1)}
.faq summary{cursor:pointer;font:700 19px var(--fh);letter-spacing:.03em;color:var(--bone)}.faq summary:hover{color:var(--amber)}
.faq details p{max-width:70ch;font-size:17px;margin:14px 0 0}
/* ---------- telas menores ---------- */
@media(max-width:1180px){.mech-grid{grid-template-columns:repeat(2,1fr)}.res-grid{grid-template-columns:repeat(2,1fr)}.fcard:nth-child(even){margin-top:0}.w-grid{grid-template-columns:repeat(2,1fr)}.squad-grid{grid-template-columns:repeat(2,1fr)}.hg-grid{gap:34px}.spec-tag{display:none}.hero-bar li{padding-right:24px;margin-right:24px}}
@media(max-width:960px){.gp,.ptw,.hg-grid,.brief-grid{grid-template-columns:minmax(0,1fr)}.ptw-head,.ptw-list{min-width:0}.gp{gap:22px}.brief-grid{gap:40px}.ptw-head{border-right:0;border-bottom:1px solid rgba(255,255,255,.08);padding:48px 32px 40px}.ptw-list{padding:20px 32px 44px}.mech-grid,.mode-grid{grid-template-columns:1fr;gap:22px}.mech-card>.label{min-height:0}.mode-card .desc{min-height:0}.gp-tabs{flex-direction:row;overflow-x:auto;gap:12px;padding-bottom:4px}.gp-tabs button{flex:0 0 78%}.gp-tabs .foot-note{display:none}.hero-shade{background:linear-gradient(90deg,rgba(9,11,15,.94) 0,rgba(9,11,15,.7) 55%,rgba(9,11,15,.25)),linear-gradient(0deg,var(--bg),transparent 26%)}.hero-stage{opacity:.75}}
@media(max-width:700px){.hero{align-items:flex-end}.hero-stage{height:56%;right:-70px}.hero-shade{background:linear-gradient(0deg,var(--bg) 42%,rgba(9,11,15,.55) 64%,rgba(9,11,15,.15)),linear-gradient(180deg,rgba(9,11,15,.5),transparent 14%)}.hero-stage{opacity:1}.hero-in{padding-top:300px;padding-bottom:250px}.hero h1 .t1{font-size:clamp(44px,14.4vw,92px)}.hero h1 .t2{font-size:clamp(26px,8vw,50px)}.hero-lead{font-size:17.5px;margin:22px 0 28px}.dim{display:none}.hero-bar ul{flex-direction:column}.hero-bar li{padding:13px 0;margin:0;border:0;border-bottom:1px solid rgba(255,255,255,.1)}.hero-bar li:last-child{border:0}.art-note{display:none}.res-grid,.w-grid,.squad-grid{grid-template-columns:1fr}.fcard{aspect-ratio:4/3.6}.ptw-head{padding:40px 26px 32px}.ptw-head .h2{font-size:clamp(36px,11.4vw,70px)}.ptw-list{padding:12px 22px 40px}.ptw-list li{grid-template-columns:40px 1fr;gap:14px}.hg-list li{grid-template-columns:42px 1fr;gap:14px;padding:16px 12px}.control-grid{grid-template-columns:1fr;padding:6px 22px}.control-grid>div:nth-last-child(2){border-bottom:1px solid rgba(255,255,255,.08)}.lineup{padding:64px 0 80px}.lineup-photo{margin-bottom:40px}.mtag{display:none}.squad-cta .btn-ghost{width:100%;justify-content:center;text-align:center;line-height:1.5}.gp-play{width:64px;height:64px;margin:-32px 0 0 -32px;top:36%}.gp-stage figcaption{padding:44px 18px 16px}.gp-stage figcaption b{font-size:20px}.gp-stage figcaption span{font-size:14.5px}}
`;
