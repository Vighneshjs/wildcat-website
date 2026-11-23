import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"

// #region story
// Pure: scroll → beats, the letter reveal, the card swing and the seeded random.
// No React, no DOM — the test lifts this region and runs it.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Smootherstep: zero velocity at both ends, so one beat hands over to the next without a jolt. */
export const smooth = (x: number) => {
  x = clamp01(x)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** 0 → 1 while the stage is pinned inside its track; clamps outside it, never NaN. */
export const progressFrom = (top: number, height: number, stage: number) => {
  const travel = height - stage
  if (!(travel > 0)) return 0
  return clamp01((0 - top) / travel)
}

/** 0 → 1 from the moment a block's top enters the viewport until its bottom leaves it. */
export const flowFrom = (top: number, height: number, vh: number) => {
  const span = vh + height
  if (!(span > 0)) return 0
  return clamp01((vh - top) / span)
}

/** Each beat's slice of the pinned scroll. They overlap on purpose, as in the reference. */
export const BEATS = {
  hero: [0, 0.4],
  rise: [0.12, 0.38],
  reveal: [0.3, 0.55],
  line: [0.5, 0.82],
  swing: [0.6, 0.9],
  settle: [0.86, 0.98],
} as const

export type Beat = { hy: number; ab: number; rv: number; wl: number; sw: number; st: number }

export function story(p: number): Beat {
  const span = (b: readonly [number, number]) => (p - b[0]) / (b[1] - b[0])
  return {
    hy: smooth(span(BEATS.hero)),
    ab: smooth(span(BEATS.rise)),
    rv: clamp01(span(BEATS.reveal)),
    wl: smooth(span(BEATS.line)),
    sw: smooth(span(BEATS.swing)),
    st: smooth(span(BEATS.settle)),
  }
}

/** The static page reduced motion shows: everything arrived, nothing moving. */
export const STILL: Beat = { hy: 0, ab: 1, rv: 1, wl: 1, sw: 1, st: 1 }

/** Letter i of n: how far it has arrived. A soft wave W letters wide runs through the line. The CSS mirrors this. */
export const REVEAL_W = 8
export const letterAlpha = (rv: number, i: number, n: number) => clamp01((rv * (n + REVEAL_W) - i) / REVEAL_W)

/** The cream page swings in like a tossed card: a corner first, then the side, then it lands square. */
export const SWING = { rot: -140, rise: 150, drift: 10, scale: 0.84 }
export const swingPose = (sw: number) => ({
  rot: SWING.rot * (1 - sw),
  ty: SWING.rise * (1 - sw),
  tx: SWING.drift * (1 - sw),
  sc: SWING.scale + (1 - SWING.scale) * sw,
})

/** The orange squiggle: the intro draws its first half over time, the scroll draws the rest. */
export const INTRO_MS = 1500
export const squiggle = (ms: number, hy: number) => Math.min(1, 0.5 * smooth(ms / INTRO_MS) + 0.5 * clamp01(hy))

/** Where the menu jumps to, in pinned progress. Each lands on a held beat, not mid-motion. */
export const JUMPS = { top: 0, about: 0.58, gallery: 0.99 } as const

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Five taps on the flower within this window turn golden hour on (or off). */
export const EGG_TAPS = 5
export const EGG_WINDOW = 2400
export function tapEgg(times: number[], now: number) {
  const recent = times.filter((t) => now - t < EGG_WINDOW).concat(now)
  return recent.length >= EGG_TAPS ? { times: [] as number[], fire: true } : { times: recent, fire: false }
}
// #endregion

type Action = { label: string; href?: string; onClick?: () => void }

export type VellumJournalTemplateProps = {
  contact: { address: string; phones: readonly string[]; email: string; map: string }
  /** Height of the pinned stage; every chapter is laid out against it. */
  height?: string
  /** Scroll travel, in stage heights, that the pinned story plays across. */
  scrollLength?: number
  brand?: string
  headline?: [string, string]
  tagline?: string
  aboutTitle?: [string, string]
  aboutBody?: [string, string]
  /** The cream page's headline; the flower sits between the two halves. */
  galleryTitle?: [string, string]
  galleryBody?: [string, string]
  /** Words that slide past under the gallery headline. */
  shelf?: string[]
  issue?: string
  year?: string
  primaryAction?: Action
  secondaryAction?: Action
  className?: string
  style?: CSSProperties
}

type Tile = { a: number; d: number; src: string; t: string; c?: string }

const FEATURE = "/media/wildcat-gaming-pc-kollam.webp"
const TILES: Tile[] = [
  { a: 1.28, d: 0.8, src: "/media/detail-01.webp", t: "Red-lit gaming PC tower", c: "Gaming build" },
  { a: 0.9, d: 1.2, src: "/media/hardware-02.webp", t: "Precision tools used on a laptop board" },
  { a: 0.95, d: 0.55, src: "/media/hardware-03.webp", t: "Blue-lit desktop graphics card and cooling fans" },
  { a: 1.3, d: 0.9, src: "/media/detail-04.webp", t: "Wildcat emblem on the shop wall" },
  { a: 1.25, d: 1.1, src: "/media/hardware-05.webp", t: "Screwdriver servicing an open laptop motherboard" },
  { a: 0.85, d: 0.6, src: "/media/hardware-06.webp", t: "Desktop tower with illuminated fans and memory" },
  { a: 1.05, d: 1, src: "/media/hardware-07.webp", t: "White-lit gaming PC cooling hardware" },
  { a: 2.6, d: 1.3, src: "/media/detail-08.webp", t: "Hands inspecting a desktop circuit board" },
  { a: 1.2, d: 0.7, src: "/media/hardware-09.webp", t: "Hands working on the internals of a laptop" },
  { a: 0.95, d: 0.75, src: "/media/hardware-10.webp", t: "Dark desktop build with a graphics card and liquid cooler" },
  { a: 2.2, d: 1.2, src: "/media/hardware-11.webp", t: "Close-up of tools and a laptop circuit board" },
  { a: 0.9, d: 1, src: "/media/hardware-12.webp", t: "Memory modules inside a gaming PC" },
  { a: 1.2, d: 0.65, src: "/media/hardware-13.webp", t: "Graphics card and radiator in a desktop PC" },
  { a: 1.05, d: 0.95, src: "/media/hardware-14.webp", t: "Gaming computer with a liquid cooling loop" },
  { a: 1.3, d: 0.8, src: "/media/detail-15.webp", t: "Full desktop setup at Wildcat", c: "Meeyanoor" },
  { a: 1.1, d: 1.15, src: "/media/hardware-16.webp", t: "Processor cooling and temperature display" },
]

const DISPLAY = "'Barlow Condensed','Arial Narrow',sans-serif"
const SANS = "'Source Sans 3',sans-serif"

const CSS =
  ".vg-root{position:relative;width:100%;isolation:isolate;background:#f6f1ea;color:#1b1916;--hy:0;--ab:0;--rv:0;--sw:0;--st:0;--mx:0;--my:0;--f:0;-webkit-tap-highlight-color:transparent}" +
  ".vg-root *,.vg-root *::before,.vg-root *::after{box-sizing:border-box}" +
  ".vg-root img,.vg-root svg,.vg-root canvas{max-width:none}" +
  ".vg-root button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}" +
  ".vg-root a{color:inherit;text-decoration:none}" +
  ".vg-sans{font-family:" + SANS + ";font-weight:500;text-transform:uppercase;letter-spacing:.14em}" +
  /* header: one bar for every chapter; difference blending keeps it legible on cream and on black */
  ".vg-head{position:sticky;top:0;height:0;z-index:40;mix-blend-mode:difference}" +
  ".vg-bar{position:absolute;left:0;right:0;top:0;height:64px;display:flex;align-items:center;justify-content:center;gap:28px;color:#fff;pointer-events:none}" +
  ".vg-logo{font-size:10px;letter-spacing:.18em;pointer-events:auto}" +
  ".vg-burger{position:relative;width:34px;height:22px;pointer-events:auto;transition:transform .5s cubic-bezier(.3,1.6,.5,1)}" +
  ".vg-burger i{position:absolute;left:4px;right:4px;height:1px;background:currentColor;transition:transform .45s cubic-bezier(.6,0,.2,1),top .45s cubic-bezier(.6,0,.2,1)}" +
  ".vg-burger i:first-child{top:8px}.vg-burger i:last-child{top:13px}" +
  ".vg-root[data-menu] .vg-burger i:first-child{top:10.5px;transform:rotate(20deg)}.vg-root[data-menu] .vg-burger i:last-child{top:10.5px;transform:rotate(-20deg)}" +
  ".vg-menu{position:fixed;left:0;right:0;top:0;z-index:39;background:#f6f1ea;color:#1b1916;padding:92px 6vw 40px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px 4vw;transform:translateY(calc(-100% - 60px));transition:transform .28s ease-out;box-shadow:0 30px 60px -40px rgba(0,0,0,.4)}" +
  ".vg-root[data-menu] .vg-menu{transform:none}" +
  ".vg-menu button{display:flex;align-items:baseline;gap:12px;text-align:left;font-family:" + DISPLAY + ";font-size:clamp(28px,3.4vw,46px);line-height:1}" +
  ".vg-menu button small{font-family:" + SANS + ";font-size:10px;letter-spacing:.14em;color:#8a847b}" +
  ".vg-menu button span{background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size .5s cubic-bezier(.6,0,.2,1)}" +
  ".vg-menu button:hover span,.vg-menu button:focus-visible span{background-size:100% 1px}" +
  /* the pinned track */
  ".vg-track{position:relative}" +
  ".vg-stage{position:sticky;top:0;z-index:2;width:100%;overflow:hidden;container-type:size;background:#f6f1ea}" +
  ".vg-layer{position:absolute;inset:0;container-type:size;overflow:hidden}" +
  /* hero */
  ".vg-hero{background:#f6f1ea}" +
  ".vg-photos{position:absolute;inset:max(68px,11cqh) clamp(18px,6cqw,100px) 7cqh;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:36cqh clamp(8px,2cqw,28px);align-items:center;justify-items:center}" +
  ".vg-tile{position:relative;width:min(100%,16cqh,8rem);transform:translate3d(calc(var(--mx) * var(--d) * -5px),calc(var(--my) * var(--d) * -5px - var(--hy) * var(--d) * 38cqh),0)}" +
  ".vg-tile-in{animation:vg-pop .65s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(.18s + var(--k) * 32ms)}" +
  ".vg-photo{display:block;width:100%;height:min(15cqh,112px);overflow:hidden;transition:transform .6s cubic-bezier(.2,.8,.2,1)}" +
  ".vg-photo img{display:block;width:100%;height:100%;max-width:none;object-fit:contain}" +
  ".vg-tile button:hover .vg-photo,.vg-tile button:focus-visible .vg-photo{transform:scale(1.06)}" +
  ".vg-tile button{display:block;width:100%;outline-offset:4px}" +
  ".vg-cap{position:absolute;top:100%;left:0;display:flex;gap:6px;margin-top:5px;font-size:8px;white-space:nowrap}" +
  ".vg-cap::before{content:'';width:10px;height:1px;background:currentColor;align-self:center}" +
  ".vg-h1wrap{position:absolute;left:0;right:0;top:34%;text-align:center;transform:translate3d(calc(var(--mx) * -6px),calc(var(--hy) * -16cqh),0)}" +
  ".vg-h1{margin:0;font-family:" + DISPLAY + ";font-weight:500;font-size:min(8.6cqw,15.5cqh);line-height:1.02;letter-spacing:-.01em;color:#1b1916}" +
  ".vg-ln{display:block;transform-origin:50% 70%;animation:vg-flip .95s cubic-bezier(.2,.75,.15,1) both;animation-delay:calc(var(--l) * .14s + .05s)}" +
  ".vg-tag{margin-top:2.4cqh;font-size:9px;display:flex;justify-content:center;gap:8px}" +
  ".vg-squig{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}" +
  ".vg-squig path{fill:none;stroke:#e2603a;stroke-width:1.6;stroke-linecap:round;vector-effect:non-scaling-stroke}" +
  /* about: the black page rises over the hero */
  ".vg-about{background:#0d0c0b;color:#f3efe8;transform:translate3d(0,calc((1 - var(--ab)) * 100cqh),0);will-change:transform}" +
  ".vg-alabel{position:absolute;left:21cqw;top:15cqh;font-size:9px;color:#c9c3b8}" +
  ".vg-quote{position:absolute;left:5cqw;top:24cqh;font-family:" + DISPLAY + ";font-size:min(8cqw,13cqh);line-height:1}" +
  ".vg-side{position:absolute;left:4cqw;top:42cqh;font-size:8px;display:flex;gap:14px;color:#c9c3b8}" +
  ".vg-side::before{content:'';width:10px;height:1px;background:currentColor;align-self:center}" +
  ".vg-h2{position:absolute;left:21cqw;right:4cqw;top:21cqh;margin:0;font-family:" + DISPLAY + ";font-weight:500;font-size:min(6.6cqw,12.5cqh);line-height:1.05;letter-spacing:-.012em}" +
  ".vg-h2 .vg-w{display:inline-block;white-space:nowrap}" +
  ".vg-ch{display:inline-block;--a:clamp(0,calc((var(--rv) * (var(--n) + 8) - var(--i)) / 8),1);opacity:calc(.08 + var(--a) * .92);transform:translate3d(calc((1 - var(--a)) * .42em),0,0);filter:blur(calc((1 - var(--a)) * 6px))}" +
  ".vg-cols{position:absolute;left:21cqw;right:12cqw;top:56cqh;display:grid;grid-template-columns:repeat(2,minmax(0,22cqw));gap:4cqw;font-family:" + SANS + ";font-size:clamp(10px,.82cqw,13px);line-height:1.6;color:#a39d93;opacity:calc(var(--rv) * 1.4 - .4)}" +
  ".vg-cols p,.vg-gcols p{margin:0}" +
  ".vg-wire{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}" +
  ".vg-wire path{fill:none;stroke:#f3efe8;stroke-width:1.3;stroke-linecap:round;vector-effect:non-scaling-stroke}" +
  /* gallery: the cream page tossed onto the black like a card */
  ".vg-card{position:absolute;left:0;top:0;width:100cqw;height:100cqh;background:#f6f1ea;color:#1b1916;overflow:hidden;transform-origin:50% 45%;transform:translate3d(calc((1 - var(--sw)) * 10cqw),calc((1 - var(--sw)) * 150cqh),0) rotate(calc((1 - var(--sw)) * -140deg)) scale(calc(.84 + var(--sw) * .16));box-shadow:0 40px 90px -30px rgba(0,0,0,calc((1 - var(--sw)) * .9));will-change:transform}" +
  ".vg-gh{position:absolute;left:3cqw;right:2cqw;top:11cqh;margin:0;display:flex;align-items:center;gap:.12em;font-family:" + DISPLAY + ";font-weight:500;font-size:min(15.2cqw,27cqh);line-height:1;letter-spacing:-.02em;white-space:nowrap}" +
  ".vg-gh>span:last-child{position:relative}" +
  ".vg-flower{display:inline-block;color:#e2603a;width:.78em;height:.78em;margin:0 .06em;flex:none;transform:rotate(calc(var(--st) * 90deg + var(--f) * 220deg));transition:color .6s}" +
  ".vg-flower svg{display:block;width:100%;height:100%}" +
  ".vg-flower button{display:block;width:100%;height:100%;border-radius:50%}" +
  ".vg-flower button[data-spin]{animation:vg-spin .9s cubic-bezier(.3,1.4,.4,1)}" +
  ".vg-under{position:absolute;left:-4%;top:100%;width:104%;height:.16em;overflow:visible}" +
  ".vg-under path{fill:none;stroke:#1b1916;stroke-width:1.4;stroke-linecap:round;vector-effect:non-scaling-stroke}" +
  ".vg-service-copy{position:absolute;left:49cqw;right:6cqw;top:46cqh;display:grid;justify-items:start;gap:clamp(12px,2.6cqh,24px)}" +
  ".vg-gcols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,4cqw,52px);font-family:" + SANS + ";font-size:clamp(13px,1cqw,17px);line-height:1.5;color:#4a463f}" +
  ".vg-shelf{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;margin:0;padding:0;list-style:none;font-family:" + DISPLAY + ";font-size:clamp(16px,2.1cqw,28px);line-height:1.3}" +
  ".vg-shelf::before{content:'';width:16px;height:1px;background:#1b1916}" +
  ".vg-root .vg-cta{position:relative;display:inline-flex;align-items:center;gap:12px;height:44px;padding:0 20px 0 22px;border-radius:999px;background:#1b1916;color:#f6f1ea;font-size:10px;transition:transform .6s cubic-bezier(.3,1.6,.5,1)}" +
  ".vg-root .vg-cta span{display:inline-flex;gap:12px;transition:transform .6s cubic-bezier(.3,1.6,.5,1)}" +
  ".vg-root .vg-cta.vg-ghost{background:transparent;color:#1b1916;box-shadow:inset 0 0 0 1px #1b1916}" +
  /* after the pin: the feature plate and the colophon scroll normally */
  ".vg-flow{position:relative;z-index:1;container-type:inline-size;background:#f6f1ea}" +
  ".vg-feat{position:relative;width:min(calc(100% - 2 * clamp(16px,4vw,60px)),110svh,1280px);margin:0 auto}" +
  ".vg-feat img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:contain}" +
  ".vg-year{position:absolute;left:clamp(10px,2vw,24px);top:clamp(10px,2vw,24px);font-family:" + DISPLAY + ";font-size:clamp(22px,4vw,64px);line-height:1;color:#f6f1ea;writing-mode:vertical-rl;transform:rotate(180deg);text-shadow:0 1px 8px #200a06}" +
  ".vg-fcap{font-size:clamp(11px,1.1vw,15px);color:#4a463f;display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px 16px;padding-top:10px}" +
  ".vg-end{position:relative;padding:14cqw 3cqw 0;overflow:hidden}" +
  ".vg-end-title{margin:0 0 4cqw;max-width:14ch;font-family:" + DISPLAY + ";font-weight:500;font-size:clamp(40px,7cqw,120px);line-height:.98;letter-spacing:-.015em}" +
  ".vg-acts{display:flex;flex-wrap:wrap;gap:14px}" +
  ".vg-root .vg-acts .vg-cta{position:relative;left:auto;top:auto}" +
  ".vg-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4cqw;margin-top:9cqw;padding-top:22px;border-top:1px solid rgba(27,25,22,.18);font-family:" + SANS + ";font-size:11px;line-height:1.7;color:#4a463f}" +
  ".vg-meta b{display:block;font-weight:500;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#8a847b;margin-bottom:6px}" +
  ".vg-mark{display:block;margin:5cqw 0 0;padding-bottom:.04em;font-family:" + DISPLAY + ";font-size:27cqw;line-height:.8;letter-spacing:-.03em;white-space:nowrap}" +
  ".vg-mark i{font-style:normal;color:#e2603a}" +
  /* lightbox */
  ".vg-box{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(246,241,234,.94);opacity:0;visibility:hidden;transition:opacity .45s,visibility 0s .45s}" +
  ".vg-box[data-open]{opacity:1;visibility:visible;transition:opacity .45s}" +
  ".vg-box figure{margin:0;display:grid;justify-items:center;gap:16px;transform:scale(.94);transition:transform .6s cubic-bezier(.2,.8,.2,1)}" +
  ".vg-box[data-open] figure{transform:none}" +
  ".vg-box figure button{display:block}" +
  ".vg-box img{display:block;width:auto;height:min(70vh,640px);max-width:86vw;object-fit:contain;box-shadow:0 40px 80px -40px rgba(0,0,0,.45)}" +
  ".vg-box figcaption{display:flex;gap:22px;font-size:10px}" +
  ".vg-box figcaption i{font-style:normal;font-family:" + DISPLAY + ";font-size:22px;letter-spacing:0;text-transform:none}" +
  ".vg-x{position:absolute;right:24px;top:20px;font-size:10px}" +
  /* toast */
  ".vg-toast{position:fixed;left:50%;bottom:28px;z-index:70;transform:translate3d(-50%,20px,0);opacity:0;padding:12px 18px;border-radius:999px;background:#1b1916;color:#f6f1ea;font-size:10px;pointer-events:none;transition:opacity .4s,transform .5s cubic-bezier(.2,.8,.2,1)}" +
  ".vg-toast[data-on]{opacity:1;transform:translate3d(-50%,0,0)}" +
  /* context cursor */
  ".vg-cursor{display:none;position:fixed;left:0;top:0;z-index:80;pointer-events:none}" +
  ".vg-cdot{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#e2603a;transition:transform .35s cubic-bezier(.3,1.6,.5,1),opacity .3s}" +
  ".vg-badge{position:absolute;left:-46px;top:-46px;width:92px;height:92px;border-radius:50%;background:#fbf8f3;color:#1b1916;box-shadow:0 10px 30px -12px rgba(0,0,0,.35);transform:scale(.2);opacity:0;transition:transform .45s cubic-bezier(.3,1.5,.5,1),opacity .3s}" +
  ".vg-ring{position:absolute;inset:0;width:100%;height:100%;animation:vg-turn 9s linear infinite}" +
  ".vg-ring text{font-family:" + SANS + ";font-size:8.4px;font-weight:500;letter-spacing:.18em;fill:currentColor}" +
  ".vg-badge>svg:last-child{position:absolute;left:31px;top:31px;width:30px;height:30px}" +
  ".vg-cursor[data-label] .vg-badge{transform:scale(1);opacity:1}" +
  ".vg-cursor[data-label] .vg-cdot{transform:scale(0);opacity:0}" +
  ".vg-cursor[data-out] .vg-cdot,.vg-cursor[data-out] .vg-badge{opacity:0}" +
  "@media (hover:hover) and (pointer:fine){.vg-cursor{display:block}.vg-root[data-fine],.vg-root[data-fine] button,.vg-root[data-fine] a{cursor:none}}" +
  ".vg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
  /* golden hour (the easter egg) */
  ".vg-root[data-gold] .vg-photo img,.vg-root[data-gold] .vg-feat img{filter:sepia(.45) saturate(1.35) hue-rotate(-8deg) brightness(1.04)}" +
  ".vg-root[data-gold] .vg-flower{color:#d9a420}" +
  ".vg-root[data-gold] .vg-hero,.vg-root[data-gold] .vg-card,.vg-root[data-gold] .vg-flow{background:#f6e9d3}" +
  ".vg-hero,.vg-card,.vg-flow{transition:background-color 1.2s}" +
  /* small screens: the tiles grow, columns stack */
  "@container (max-width:700px){.vg-squig{left:-40cqw;width:260cqw;top:22cqh}.vg-cap{display:none}.vg-h1{font-size:12cqw}.vg-h2{left:6cqw;font-size:9.6cqw;top:24cqh}.vg-alabel{left:6cqw;top:17cqh}.vg-quote,.vg-side{display:none}.vg-cols{left:6cqw;right:6cqw;grid-template-columns:1fr;gap:12px;top:52cqh}.vg-gh{flex-wrap:wrap;top:14cqh;font-size:16cqw;white-space:normal;gap:0 .2em;justify-content:flex-start}.vg-service-copy{left:6cqw;right:6cqw;top:39cqh}.vg-gcols{grid-template-columns:1fr;gap:8px}}" +
  "@container (max-width:700px){.vg-meta{grid-template-columns:1fr}.vg-end{padding-top:22cqw}}" +
  "@keyframes vg-flip{0%{transform:perspective(900px) rotateX(168deg) translateY(12%);opacity:0}18%{opacity:.55}100%{transform:none;opacity:1}}" +
  "@keyframes vg-pop{from{opacity:0;transform:scale(.6) translateY(16px)}}" +
  "@keyframes vg-turn{to{transform:rotate(360deg)}}" +
  "@keyframes vg-spin{from{transform:rotate(-360deg) scale(.7)}}" +
  /* reduced motion: nothing flies; the chapters simply stack as pages */
  "@media (prefers-reduced-motion:reduce){.vg-ln,.vg-tile-in,.vg-ring,.vg-flower button[data-spin]{animation:none}.vg-menu,.vg-box,.vg-box figure,.vg-toast,.vg-cta,.vg-cta span,.vg-burger,.vg-burger i,.vg-badge,.vg-cdot,.vg-photo{transition:none}}" +
  ".vg-root[data-still] .vg-track{height:auto!important}" +
  ".vg-root[data-still] .vg-stage{position:relative;height:auto!important;container-type:normal;overflow:visible}" +
  ".vg-root[data-still] .vg-layer{position:relative;height:var(--H);transform:none}" +
  ".vg-root[data-still] .vg-card{position:relative;transform:none;box-shadow:none;height:var(--H)}" +
  ".vg-root[data-still] .vg-cardwrap{position:relative;height:var(--H);overflow:visible;background:#0d0c0b}" +
  ".vg-root[data-still] .vg-tile,.vg-root[data-still] .vg-h1wrap,.vg-root[data-still] .vg-flower,.vg-root[data-still] .vg-ch{transform:none}" +
  ".vg-root[data-still] .vg-ch{opacity:1;filter:none}.vg-root[data-still] .vg-cols{opacity:1}"

const SQUIGGLE = "M200 360 C 150 330, 105 352, 118 378 C 132 404, 196 386, 232 350 C 262 320, 300 330, 296 372 C 292 420, 250 450, 268 488 C 284 522, 340 512, 352 548 C 360 572, 340 590, 360 610"
const WIRE = "M-20 880 C 120 840, 220 900, 340 860 C 470 815, 520 760, 640 790 C 780 826, 820 700, 980 690 C 1080 684, 1120 720, 1040 760"
const UNDER = "M0 30 C 60 26, 110 22, 120 14 C 128 6, 112 0, 104 8 C 96 18, 110 32, 136 30 C 200 26, 330 22, 420 16"

function Flower({ size }: { size?: number }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true" style={{ display: "block", maxWidth: "none" }}>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} transform={"rotate(" + (a + 45) + ")"} d="M0 -4 C 14 -14, 18 -38, 0 -48 C -18 -38, -14 -14, 0 -4 Z" fill="currentColor" />
      ))}
    </svg>
  )
}

const ringText = (label: string) => {
  const t = label.toUpperCase() + " • "
  return t.repeat(Math.max(1, Math.round(34 / t.length)))
}


/* ---------------------------------------------------------------------------- */

export default function VellumJournalTemplate({
  height = "100svh",
  scrollLength = 2.9,
  brand = "Vellum",
  headline = ["Notice The Light", "Wherever It Falls"],
  tagline = "& frame it your own way",
  aboutTitle = ["A Room For The", "Patient Image Makers"],
  aboutBody = [
    "We gather quiet, carefully made photographs from people who still wait for the right light, and print them the way they deserve.",
    "If you shoot slowly and would like your work in front of our readers, send us a set. We answer every submission, usually within two weeks.",
  ],
  galleryTitle = ["Light", "On Paper"],
  galleryBody = [
    "Each season we choose twelve photographers and give their work room: large plates, honest paper and no crop they didn't ask for.",
    "Prints ship flat in archival sleeves, signed and numbered, from our small studio by the sea.",
  ],
  shelf = ["Vellum", "Gallery", "Archive", "Prints", "Journal"],
  issue = "Issue 07, The Weather Inside. Fourteen portraits made in the hour before rain, printed on cotton rag.",
  year = "2026",
  primaryAction = { label: "Submit your work" },
  secondaryAction = { label: "Browse the archive" },
  contact,
  className,
  style,
}: VellumJournalTemplateProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const fid = "vgw" + uid
  const rootRef = useRef(null as HTMLDivElement | null)
  const trackRef = useRef(null as HTMLDivElement | null)
  const flowRef = useRef(null as HTMLDivElement | null)
  const cursorRef = useRef(null as HTMLDivElement | null)
  const ringRef = useRef(null as SVGTextPathElement | null)
  const h1Ref = useRef(null as HTMLDivElement | null)
  const dispRef = useRef(null as SVGFEDisplacementMapElement | null)
  const sqRef = useRef(null as SVGPathElement | null)
  const wireRef = useRef(null as SVGPathElement | null)
  const underRef = useRef(null as SVGPathElement | null)
  const flowerRef = useRef(null as HTMLButtonElement | null)
  const toastTimer = useRef(0)
  const s = useRef({
    target: 0,
    cur: 0,
    f: 0,
    fCur: 0,
    tx: 0,
    ty: 0,
    mx: 0,
    my: 0,
    still: false,
    fine: false,
    born: 0,
    intro: true,
    trackTop: 0,
    trackH: 0,
    stageH: 0,
    flowTop: 0,
    flowH: 0,
    written: "",
    label: "",
    magnet: null as HTMLElement | null,
    magnetBox: null as DOMRect | null,
    taps: [] as number[],
  })
  const [still, setStill] = useState(false)
  const [menu, setMenu] = useState(false)
  const [box, setBox] = useState(-1)
  const [gold, setGold] = useState(false)
  const [toast, setToast] = useState({ text: "", on: false })
  const [spin, setSpin] = useState(0)

  const words = useMemo(() => {
    let i = 0
    const n = aboutTitle.join(" ").replace(/\s+/g, "").length
    return {
      n,
      lines: aboutTitle.map((line) =>
        line.split(" ").map((w) => w.split("").map((ch) => ({ ch, i: i++ }))),
      ),
    }
  }, [aboutTitle])

  const say = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, on: true })
    toastTimer.current = window.setTimeout(() => setToast((t) => ({ ...t, on: false })), 2600)
  }, [])

  const run = useCallback(
    (a: Action) => {
      if (a.onClick) a.onClick()
      else if (!a.href) say(a.label + ": opens in spring")
    },
    [say],
  )

  // runtime gates: reduced motion and a fine, hovering pointer
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)")
    const fp = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => {
      s.current.still = rm.matches
      s.current.fine = fp.matches
      const root = rootRef.current
      if (root) {
        if (fp.matches) root.dataset.fine = ""
        else delete root.dataset.fine
      }
      setStill(rm.matches)
    }
    sync()
    rm.addEventListener("change", sync)
    fp.addEventListener("change", sync)
    return () => {
      rm.removeEventListener("change", sync)
      fp.removeEventListener("change", sync)
    }
  }, [])

  // layout is cached here, on mount and on resize; scroll only reads the root's rect
  const layout = useCallback(() => {
    const root = rootRef.current
    const track = trackRef.current
    const flow = flowRef.current
    if (!root || !track || !flow) return
    const st = s.current
    st.trackTop = track.offsetTop
    st.trackH = track.offsetHeight
    st.stageH = (track.firstElementChild as HTMLElement | null)?.offsetHeight || 0
    st.flowTop = flow.offsetTop
    st.flowH = flow.offsetHeight
  }, [])

  // scroll → progress: one layout read per scroll frame
  const measure = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const st = s.current
    const top = root.getBoundingClientRect().top
    st.target = progressFrom(top + st.trackTop, st.trackH, st.stageH)
    st.f = flowFrom(top + st.flowTop, st.flowH, window.innerHeight)
    if (st.magnet) release()
  }, [])

  const jump = useCallback((to: "top" | "about" | "gallery" | "feature" | "end") => {
    const root = rootRef.current
    if (!root) return
    const st = s.current
    const top = root.getBoundingClientRect().top
    const travel = st.trackH - st.stageH
    if (st.still && (to === "about" || to === "gallery")) {
      setMenu(false)
      root.querySelector(to === "about" ? "#about" : "#services")?.scrollIntoView({ block: "start" })
      return
    }
    const y =
      to === "feature" ? (root.querySelector("#feature") as HTMLElement).getBoundingClientRect().top - top - 72 : to === "end" ? (root.querySelector("#contact") as HTMLElement).getBoundingClientRect().top - top : st.trackTop + JUMPS[to] * travel
    setMenu(false)
    window.scrollBy({ top: top + y, behavior: "auto" })
  }, [])

  // the frame loop: eases toward the scroll and the pointer, then writes a few variables
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const st = s.current
    let raf = 0
    let last = performance.now()
    let running = false
    let alive = true
    st.born = last
    st.intro = !st.still
    const h1 = h1Ref.current
    if (h1 && st.still) h1.style.filter = "none"
    const frame = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const k = 1 - Math.exp(-dt / 50)
      st.cur = st.still ? 1 : Math.abs(st.cur - st.target) < 1e-4 ? st.target : st.cur + (st.target - st.cur) * k
      st.fCur = st.still ? 0.5 : Math.abs(st.fCur - st.f) < 1e-4 ? st.f : st.fCur + (st.f - st.fCur) * k
      const km = 1 - Math.exp(-dt / 220)
      st.mx += ((st.fine && !st.still ? st.tx : 0) - st.mx) * km
      st.my += ((st.fine && !st.still ? st.ty : 0) - st.my) * km
      const b = st.still ? STILL : story(st.cur)
      const age = now - st.born
      if (st.intro && age > INTRO_MS + 200) {
        st.intro = false
        if (h1) h1.style.filter = "none"
      }
      if (st.intro && dispRef.current) dispRef.current.setAttribute("scale", (38 * (1 - smooth(age / 850))).toFixed(2))
      const sq = st.still ? 1 : squiggle(age, b.hy)
      const key = [b.hy, b.ab, b.rv, b.wl, b.sw, b.st, st.mx, st.my, st.fCur, sq].map((v) => v.toFixed(4)).join()
      if (key !== st.written) {
        st.written = key
        const cs = root.style
        cs.setProperty("--hy", b.hy.toFixed(4))
        cs.setProperty("--ab", b.ab.toFixed(4))
        cs.setProperty("--rv", b.rv.toFixed(4))
        cs.setProperty("--sw", b.sw.toFixed(4))
        cs.setProperty("--st", b.st.toFixed(4))
        cs.setProperty("--mx", st.mx.toFixed(4))
        cs.setProperty("--my", st.my.toFixed(4))
        cs.setProperty("--f", st.fCur.toFixed(4))
        sqRef.current?.setAttribute("stroke-dashoffset", (1 - sq).toFixed(4))
        wireRef.current?.setAttribute("stroke-dashoffset", (1 - b.wl).toFixed(4))
        underRef.current?.setAttribute("stroke-dashoffset", (1 - b.st).toFixed(4))
      }
      if (alive && (running || st.intro)) raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (running) return
      running = true
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
    }
    layout()
    measure()
    st.cur = st.target
    st.fCur = st.f
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((e) => (e[0]?.isIntersecting ? start() : stop())) : null
    if (io) io.observe(root)
    else start()
    raf = requestAnimationFrame(frame)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => (layout(), measure())) : null
    ro?.observe(root)
    const onScroll = () => measure()
    addEventListener("scroll", onScroll, { passive: true, capture: true })
    addEventListener("resize", onScroll)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      io?.disconnect()
      ro?.disconnect()
      removeEventListener("scroll", onScroll, { capture: true })
      removeEventListener("resize", onScroll)
    }
  }, [layout, measure, still])

  // keyboard: Escape closes, arrows walk the lightbox
  useEffect(() => {
    if (box < 0 && !menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBox(-1)
        setMenu(false)
      } else if (box >= 0 && e.key === "ArrowRight") setBox((b) => (b + 1) % TILES.length)
      else if (box >= 0 && e.key === "ArrowLeft") setBox((b) => (b + TILES.length - 1) % TILES.length)
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [box, menu])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  /* ---- pointer: context cursor, parallax and magnets (mouse only) ---- */
  function release() {
    const m = s.current.magnet
    if (m) {
      m.style.transform = ""
      const inner = m.firstElementChild as HTMLElement | null
      if (inner) inner.style.transform = ""
    }
    s.current.magnet = null
    s.current.magnetBox = null
  }

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return
    const st = s.current
    if (!st.fine) return
    const cur = cursorRef.current
    if (cur) {
      cur.style.transform = "translate3d(" + e.clientX + "px," + e.clientY + "px,0)"
      delete cur.dataset.out
    }
    st.tx = (e.clientX / window.innerWidth) * 2 - 1
    st.ty = (e.clientY / window.innerHeight) * 2 - 1
    const t = e.target as Element | null
    const hit = t && t.closest ? (t.closest("[data-cursor]") as HTMLElement | null) : null
    const label = hit ? hit.dataset.cursor || "" : ""
    if (label !== st.label) {
      st.label = label
      if (cur) {
        if (label) cur.dataset.label = ""
        else delete cur.dataset.label
      }
      if (label && ringRef.current) ringRef.current.textContent = ringText(label)
    }
    if (st.still) return
    const mag = t && t.closest ? (t.closest("[data-magnet]") as HTMLElement | null) : null
    if (mag !== st.magnet) {
      release()
      if (mag) {
        st.magnet = mag
        st.magnetBox = mag.getBoundingClientRect()
      }
    }
    const m = st.magnet
    const r = st.magnetBox
    if (m && r) {
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      m.style.transform = "translate3d(" + (dx * 0.32).toFixed(1) + "px," + (dy * 0.4).toFixed(1) + "px,0)"
      const inner = m.firstElementChild as HTMLElement | null
      if (inner) inner.style.transform = "translate3d(" + (dx * 0.14).toFixed(1) + "px," + (dy * 0.18).toFixed(1) + "px,0)"
    }
  }

  const onLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return
    release()
    s.current.tx = 0
    s.current.ty = 0
    s.current.label = ""
    const cur = cursorRef.current
    if (cur) {
      cur.dataset.out = ""
      delete cur.dataset.label
    }
  }

  const pickFlower = () => {
    setSpin((n) => n + 1)
    const st = s.current
    const r = tapEgg(st.taps, Date.now())
    st.taps = r.times
    if (r.fire) {
      setGold((g) => {
        say(g ? "Back to daylight." : "Golden hour. Everything looks better now.")
        return !g
      })
    }
  }

  useEffect(() => {
    const f = flowerRef.current
    if (!f || !spin) return
    delete f.dataset.spin
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => (f.dataset.spin = "")))
    return () => cancelAnimationFrame(raf)
  }, [spin])

  const H = height
  const rootStyle = { "--H": H, ...style } as CSSProperties
  const shown = box >= 0 ? TILES[box] : null

  const cta = (a: Action, ghost: boolean, extra?: CSSProperties) => {
    const inner = (
      <span>
        {a.label}
        <span aria-hidden="true">{"→"}</span>
      </span>
    )
    const cls = "vg-cta vg-sans" + (ghost ? " vg-ghost" : "")
    return a.href ? (
      <a className={cls} href={a.href} data-magnet="" data-cursor={a.label} style={extra} onClick={a.onClick}>
        {inner}
      </a>
    ) : (
      <button type="button" className={cls} data-magnet="" data-cursor={a.label} style={extra} onClick={() => run(a)}>
        {inner}
      </button>
    )
  }

  return (
    <div
      ref={rootRef}
      className={"vg-root" + (className ? " " + className : "")}
      style={rootStyle}
      data-still={still ? "" : undefined}
      data-menu={menu ? "" : undefined}
      data-gold={gold ? "" : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <filter id={fid} x="-10%" y="-40%" width="120%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.003 0.032" numOctaves={1} seed={4} />
          <feDisplacementMap ref={dispRef} in="SourceGraphic" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <header className="vg-head">
        <div className="vg-bar">
          <span className="vg-logo vg-sans">{brand} IT Solutions</span>
          <button
            type="button"
            className="vg-burger"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            data-magnet=""
            data-cursor={menu ? "Close" : "Menu"}
            onClick={() => setMenu((m) => !m)}
          >
            <i />
            <i />
          </button>
        </div>
      </header>
      <nav className="vg-menu" aria-label={brand + " sections"} aria-hidden={!menu}>
        {(
          [
            ["top", "Cover"],
            ["about", "Our story"],
            ["gallery", "Services"],
            ["feature", "Gaming build"],
            ["end", "Contact"],
          ] as const
        ).map(([k, label], i) => (
          <button key={k} type="button" data-cursor="Go" tabIndex={menu ? 0 : -1} onClick={() => jump(k)}>
            <small>{"0" + (i + 1)}</small>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div ref={trackRef} className="vg-track" style={{ height: "calc(" + H + " * " + scrollLength + ")" }}>
        <div className="vg-stage" style={{ height: H }}>
          {/* 1 · hero */}
          <section className="vg-layer vg-hero" aria-label="Cover" data-cursor="Scroll">
            <div className="vg-photos">
              {TILES.map((tile, index) => (
                <div key={tile.src} className="vg-tile" style={{ "--d": tile.d, "--k": index } as CSSProperties}>
                  <div className="vg-tile-in">
                    <button type="button" data-cursor="View photo" aria-label={"Open plate: " + tile.t} onClick={() => setBox(index)}>
                      <span className="vg-photo">
                        <img src={tile.src} alt="" width={320} height={Math.round(320 * tile.a)} decoding="async" />
                      </span>
                    </button>
                    {tile.c && <div className="vg-cap vg-sans">{tile.c}</div>}
                  </div>
                </div>
              ))}
            </div>
            <svg className="vg-squig" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <path ref={sqRef} d={SQUIGGLE} pathLength={1} strokeDasharray="1 2" strokeDashoffset={still ? 0 : 1} />
            </svg>
            <div className="vg-h1wrap">
              <div ref={h1Ref} style={{ filter: "url(#" + fid + ")" }}>
                <h1 className="vg-h1">
                  {headline.map((line, l) => (
                    <span key={l} className="vg-ln" style={{ "--l": l } as CSSProperties}>
                      {line}
                    </span>
                  ))}
                </h1>
              </div>
              <div className="vg-tag vg-sans">{tagline}</div>
            </div>
          </section>

          {/* 2 · about, on black */}
          <section id="about" className="vg-layer vg-about" aria-label="About Wildcat IT Solutions">
            <svg className="vg-wire" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <path ref={wireRef} d={WIRE} pathLength={1} strokeDasharray="1 2" strokeDashoffset={still ? 0 : 1} />
            </svg>
            <div className="vg-alabel vg-sans">About us</div>
            <div className="vg-quote" aria-hidden="true">
              {"“"}
            </div>
            <div className="vg-side vg-sans">{brand}</div>
            <h2 className="vg-h2" style={{ "--n": words.n } as CSSProperties}>
              <span className="vg-sr">{aboutTitle.join(" ")}</span>
              {words.lines.map((line, l) => (
                <span key={l} aria-hidden="true" style={{ display: "block" }}>
                  {line.map((w, wi) => (
                    <span key={wi}>
                      <span className="vg-w">
                        {w.map((c) => (
                          <span key={c.i} className="vg-ch" style={{ "--i": c.i } as CSSProperties}>
                            {c.ch}
                          </span>
                        ))}
                      </span>
                      {wi < line.length - 1 ? " " : null}
                    </span>
                  ))}
                </span>
              ))}
            </h2>
            <div className="vg-cols">
              <p>{aboutBody[0]}</p>
              <p>{aboutBody[1]}</p>
            </div>
          </section>

          {/* 3 · gallery, the cream card tossed onto the black */}
          <div className="vg-layer vg-cardwrap" style={{ overflow: "visible", pointerEvents: "none" }}>
            <section id="services" className="vg-card" aria-label="Computer services" style={{ pointerEvents: "auto" }}>
              <h2 className="vg-gh">
                <span>{galleryTitle[0]}</span>
                <span className="vg-flower">
                  <button ref={flowerRef} type="button" aria-label="Pick the flower" data-cursor="Pick me" onClick={pickFlower}>
                    <Flower />
                  </button>
                </span>
                <span>
                  {galleryTitle[1]}
                  <svg className="vg-under" viewBox="0 0 420 40" preserveAspectRatio="none" aria-hidden="true">
                    <path ref={underRef} d={UNDER} pathLength={1} strokeDasharray="1 2" strokeDashoffset={still ? 0 : 1} />
                  </svg>
                </span>
              </h2>
              <div className="vg-service-copy">
                <div className="vg-gcols">
                  <p>{galleryBody[0]}</p>
                  <p>{galleryBody[1]}</p>
                </div>
                {cta(primaryAction, false)}
                <ul className="vg-shelf" aria-label="Services">
                  {shelf.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* 4 · after the pin: the feature plate and the colophon */}
      <div ref={flowRef} className="vg-flow">
        <figure id="feature" className="vg-feat">
          <img src={FEATURE} alt="Red-lit custom gaming PC and desk at Wildcat IT Solutions in Meeyanoor, Kollam" width={1280} height={960} loading="lazy" decoding="async" />
          <span className="vg-year" aria-hidden="true">
            {year}
          </span>
          <figcaption className="vg-fcap vg-sans">
            <span>{issue}</span>
            <a href={contact.map}>See on Google Maps</a>
          </figcaption>
        </figure>
        <section id="contact" className="vg-end" aria-label="Contact Wildcat IT Solutions">
          <h2 className="vg-end-title">Need a build or a repair?</h2>
          <div className="vg-acts">
            {cta(primaryAction, false)}
            {cta(secondaryAction, true)}
          </div>
          <div className="vg-meta">
            <address>
              <b>Visit the shop</b>
              <a href={contact.map}>{contact.address}</a>
            </address>
            <div>
              <b>Call</b>
              {contact.phones.map((phone) => <a key={phone} href={"tel:+" + phone.replace(/\D/g, "")}>{phone}</a>)}
            </div>
            <div>
              <b>Email</b>
              <a href={"mailto:" + contact.email}>{contact.email}</a>
            </div>
          </div>
          <div className="vg-policies">
            <details id="terms">
              <summary>Service terms</summary>
              <p>Confirm the scope, INR quote, timing, and any cancellation or refund terms with the shop before approving work. For an existing booking, share your booking or receipt reference.</p>
            </details>
            <details id="privacy">
              <summary>Privacy</summary>
              <p>For questions about information you share by phone, email, or in person, <a href={"mailto:" + contact.email}>email the shop</a>.</p>
            </details>
          </div>
          <span className="vg-mark" aria-hidden="true">
            {brand}
            <i>.</i>
          </span>
        </section>
      </div>

      {/* lightbox */}
      <div className="vg-box" data-open={shown ? "" : undefined} role="dialog" aria-modal="true" aria-hidden={!shown} aria-label="Plate" data-cursor="Close" onClick={() => setBox(-1)}>
        {shown ? (
          <figure onClick={(e) => e.stopPropagation()}>
            <button type="button" data-cursor="Next" aria-label="Next plate" onClick={() => setBox((b) => (b + 1) % TILES.length)}>
              <img src={shown.src} alt={shown.t} />
            </button>
            <figcaption className="vg-sans">
              <span>{(shown.src.includes("/hardware-") || shown.src.endsWith("/detail-08.webp")) ? "Hardware example" : "Wildcat IT Solutions"} · {box + 1} / {TILES.length}</span>
              <i>{shown.t}</i>
            </figcaption>
          </figure>
        ) : null}
        <button type="button" className="vg-x vg-sans" data-cursor="Close" onClick={() => setBox(-1)}>
          Close
        </button>
      </div>

      <div className="vg-toast vg-sans" role="status" data-on={toast.on ? "" : undefined}>
        {toast.text}
      </div>

      <div ref={cursorRef} className="vg-cursor" aria-hidden="true" data-out="">
        <span className="vg-cdot" />
        <span className="vg-badge">
          <svg className="vg-ring" viewBox="0 0 92 92">
            <defs>
              <path id={"vgr" + uid} d="M46 46 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" />
            </defs>
            <text>
              <textPath ref={ringRef} href={"#vgr" + uid} textLength="212">
                {ringText("Scroll")}
              </textPath>
            </text>
          </svg>
          <svg viewBox="-50 -50 100 100" style={{ color: "#e2603a" }}>
            {[0, 90, 180, 270].map((a) => (
              <path key={a} transform={"rotate(" + (a + 45) + ")"} d="M0 -4 C 14 -14, 18 -38, 0 -48 C -18 -38, -14 -14, 0 -4 Z" fill={a % 180 ? "#8a847b" : "currentColor"} />
            ))}
          </svg>
        </span>
      </div>
    </div>
  )
}
