# Frame packet: 08-cierre

## Project inputs

- Project: C:\Users\Kechavarro\Documents\GitHub\Evarisbot\evarisbot\videos\evarisbot-demo
- Design tokens: C:\Users\Kechavarro\Documents\GitHub\Evarisbot\evarisbot\videos\evarisbot-demo\frame.md
- RULES_DIR: C:\Users\Kechavarro\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 8 — Cierre

- status: outline
- src: compositions/frames/08-cierre.html
- duration: 5s
- transition_in: crossfade
- scene: Vuelta al azul de marca con el nombre y el lema del hospital.
- blueprint: logo-assemble-lockup
- asset_candidates: ninguno (tipografía sobre el azul de marca)
- motion: center-outward-expansion, gradient-text-sweep

```
Scene 1 (0.0–1.2s)  El blanco se llena de azul `#2e3f84` desde el centro hacia fuera
                    (center-outward-expansion), tapando la escena anterior.
Scene 2 (1.2–2.4s)  "Evarisbot" entra centrado, blanco, grande.
Scene 3 (2.4–3.6s)  Debajo, línea fina y "Hospital Universitario del Valle".
Scene 4 (3.6–5.0s)  Aparece el lema "70 años latiendo juntos." con un barrido suave
                    (gradient-text-sweep) y se sostiene en silencio.
                    Sin llamada a la acción: el público ya está dentro del hospital.
```

## Selected blueprint: logo-assemble-lockup

# logo-assemble-lockup — Logo Assemble → Lockup

**intent**: A brand mark / wordmark comes to exist on screen and resolves into a centered logo lockup — built from parts (elements assemble or orbit in, letters cascade, an outline draws on, or a camera pushes through negative space), spring-BLOOMED whole from zero on a cleared stage, MORPHED in one unbroken chain out of the preceding phrase / glyph, absorbed from a kinetic streak, or already assembled and settling as decorations clear — optionally extended into a final URL / CTA / end card.

**roles served**

- Product_Intro (from product-intro-logo-system-assemble): A wordless, premium brand STING — an abstract system of elements pulses / grows / orbits and assembles around a FIXED central logo, carried by one cinematic camera tilt; no copy, no UI.
- CTA (from cta-camera-push-lockup): The logo build is a LEAD-IN to the final ask — a 3D mark assembles + wordmark cascades, then a fast camera PUSH-THROUGH the mark's negative space streaks giant CTA letters past the lens and resolves on a `[url]` / `[CTA verb]` lockup.
- CTA (from cta-button-wordmark-build): The "draws-its-own-outline → wordmark-builds-letter-by-letter" sub-shape — a `[CTA button]` pill strokes its own glowing border, a diagonal-band WIPE flips the frame, and the `[wordmark]` types in beside a slash to land the lockup. Camera static.
- Brand_Outro (from brand-outro-assemble-logo-lockup): The closing mark — a formation of `[feature pills / UI elements]` CLEARS the stage off all four edges, then on the empty frame the `[logo mark]` draws itself on stroke-by-stroke and the `[wordmark]` reveals to complete the lockup, then fades out.
- Product_Intro (from brand-reveal-assemble-zoom): a context-then-focus reveal — a companion tagline TYPES out to set context, the hero mark pops in beside it, then the companion exits as the layout recenters and the camera pushes IN to a held close-up on the mark (wide composition narrowing to a tight focus).
- Product_Intro (from logo-parts-lockup-assembly): the literal parts build — `[icon parts]` (a glowing dot traces a circle, semi-circles scale up and overlap, strokes rotate in) converge into the `[brand icon]` center-frame on a flat / gradient field, the `[wordmark]` joins (± a `[badge pill]` pops onto the lockup), then a payoff beat: a stepped bottom `[subtitle rail]`, a big `[count-up stat]` over a faint asset grid, or the lockup clears and a `[product UI window]` scales in. Static frame, all element-level.
- CTA (from text-clears-mark-blooms-lockup): the text-clear BLOOM — centered `[serif tagline]` beats (word-by-word staggered fades) hold, then CLEAR themselves to a blank frame; the `[brand mark]` spring-blooms from ZERO at dead center, slides left as the `[wordmark]` reveals to its right, and the balanced lockup holds (near-)still. Constant warm flat bg, static frame.
- Brand_Outro (from phrase-morphs-into-lockup): the MORPH chain — a centered `[phrase]` mutates in place, then collapses / swaps into an `[intermediate glyph]` whose line panels fan-and-flip around a central pivot with visible motion blur (page-flip feel) and interlock into the `[geometric mark]`, which slides apart into the lockup. One unbroken chain of transformation, never a cut-and-replace assembly; the finished lockup holds dead static for the final ~40–50% of runtime.
- Brand_Outro (from lead-text-then-mark-assembles): the parts-arrive build — a `[hand-off line]` holds and departs, then the mark is BUILT from arriving parts (`[icon]` drops in, letters slide in one by one, terminal punctuation lands, a confetti burst pops and instantly shrinks) OR a `[pixel stack]` streaks into full-width multicolor stripes whose tail retracts and is ABSORBED into the pixel mark — finishing as a lockup or a full end card (`[icon tile]` + `[title]` + `[URL pill]` + store badges) held static.
- Brand_Outro (from `settled-lockup-reveal`): the null-assembly boundary — the `[lockup]` is on stage from frame one; `[satellite shapes]` drift outward and fade, an accent underline sweeps beneath the wordmark, and the `[tagline]` wipes in to complete it. Settle-and-reveal: no predecessor beat, no morph, no relay.

**duration**: ~4.4–11.0s (Brand_Outro ~4.4–7.3s · brand-reveal ~5s · CTA text-clear bloom 6.0–8.9s · Product_Intro ~7s orbit sting, 7.0–9.8s parts-assembly · CTA push/build 5.4–11.0s)

**shot structure** (one consolidated time-coded template; `[slots]` are product-agnostic)

- Scene 1 — clear / ignite (0.0–~1.0s): the stage is prepared for the mark to build into.
  - _Variant — Product_Intro_: opens on a clean `[light bg]` with faint concentric guide rings under a flat top-down view; rings PULSE and expand from center; mid-beat the bg crossfades `[light]→[dark gradient: hero→secondary]`, tiny seed dots appear along the rings, and the central `[logo mark]`'s glow IGNITES (mark is present from t=0, fixed, front-facing).
  - _Variant — CTA push_: on a `[bg gradient]`, the `[logo mark]` is settling in object space (a 3D mark with thin wireframe edge-guides + a faint bracket motif behind center); a very slow continuous camera push-in may already be creeping.
  - _Variant — CTA button-build_: on a `[dark grid bg]`, a rounded `[CTA button "label"]` pill rises / scales into center (a prior headline clearing off the top); its thin border DRAWS ON as an animated glowing outline STROKE, with a small `[accent]` comet / spark icon at its left edge.
  - _Variant — Brand_Outro_: a PRE-ARRANGED formation of `[feature pills / element grid]` (each `[icon]`+`[label]`) DISPERSES — elements slide outward from their laid-out positions and fly off all four frame edges (edge-clearing drift, NOT a center-origin burst), emptying the frame onto a clean `[bg]`.
  - _Variant — Product_Intro parts-assembly_ (from logo-parts-lockup-assembly): optional text hook — a centered "`[Meet product]`" line wipes away right→left — or straight into the build; on a flat / gradient `[bg]`, the first `[icon parts]` arrive: a glowing dot traces a clockwise circle, a gradient semi-circle scales up inside it, or the mark scales-up-with-rotate into center.
  - _Variant — CTA text-clear bloom_ (from text-clears-mark-blooms-lockup): a centered `[serif tagline / question]` (± an outlined `[badge pill]`) finishes a left→right word-staggered reveal in the first ~0.5–1s (each word passing light-grey→dark) and HOLDS; optional rolling word-by-word swap to a second `[availability line]`. Then the CLEAR: text exits — shrink-toward-center + fade, or word-by-word left-first fade-out — leaving a blank frame for a beat.
  - _Variant — Brand_Outro morph-chain_ (from phrase-morphs-into-lockup): a centered `[phrase]` completes or mutates in place (a vertical slot-machine word swap — one word exits up as its replacement rises from below, rest of the line fixed — or a word-by-word landing) and holds. Nothing clears: the phrase IS the raw material for the mark.
  - _Variant — Brand_Outro parts-arrive_ (from lead-text-then-mark-assembles): a centered `[hand-off line: tagline / "Brought to you by"]` holds on a flat canvas, then exits — slides straight down off-frame with fade, or fades away behind the incoming flourish.
  - _Variant — Brand_Outro settled-reveal_ (from settled-lockup-reveal): the `[lockup]` is already centered at t=0; `[satellite shapes]` drift slowly outward around it — an INVERTED clear: the decorations leave, the mark stays.

- Scene 2 — assemble the mark (~1.0–~Ys): the mark builds itself from parts.
  - _Variant — Product_Intro_: seed dots SCALE UP into flat `[accent]` shapes arranged on the rings; concentric bands ripple outward (tunneling feel) and the shapes begin to ORBIT / drift around the still-fixed center.
  - _Variant — CTA push_: the `[wordmark]` CASCADES out from behind the mark (letters left→right with overshoot) into the full `[brand lockup]`; the 3D mark may assemble in beats (a terminal detaches + pops as a spring dot, a part hinges-open-and-snaps-shut elastic). Optional beat: a `[cursor]` arcs in and "clicks" the wordmark, OR a frosted-glass pill holding an intermediate `[CTA line]` springs in while layered mark shells fan to the edges.
  - _Variant — CTA button-build_: a graphic WIPE flips the frame to `[contrast bg]` — a thin `[accent]` diagonal line sweeps in, swells into a full-frame diagonal BAND, then collapses to a small `[accent]` slash.
  - _Variant — Brand_Outro_: on the now-clear frame, the `[logo mark]` DRAWS ON via stroke (built arc-by-arc / segment-by-segment).
  - _Variant — Product_Intro parts-assembly_: the overlapping parts COMPLETE the `[brand icon]` (a second circle overlaps to close the orb; strokes interlock); the `[wordmark]` slides out from behind the icon or in from its right; a small `[badge pill]` pops onto the lockup.
  - _Variant — CTA text-clear bloom_: on the blank frame the `[brand mark]` scales up from ZERO at dead center with a snappy spring ease (slight overshoot, hint of rotation as it grows) — the whole mark at once, no parts.
  - _Variant — Brand_Outro morph-chain_: the phrase collapses / wipes horizontally into the mark, OR is instantly swapped at the same center for a line-art `[intermediate icon]` whose strokes split into panels that fan-and-flip around a central pivot with visible motion blur, interlock-settling into the `[geometric mark]`. Never a cut to the finished logo — the transformation must stay unbroken.
  - _Variant — Brand_Outro parts-arrive_: the mark is BUILT from arriving parts — the `[icon]` drops in from above, letters slide in one by one, terminal punctuation lands, a tiny confetti burst pops and instantly shrinks — OR a colored `[pixel stack]` pops in at a text edge, shoots horizontally stretching into full-width multicolor stripes, then the stripe tail retracts and is ABSORBED into the `[pixel mark]` (mask retraction).
  - _Variant — Brand_Outro settled-reveal_: an accent underline sweeps left→right beneath the `[wordmark]` — the only "build" this variant performs.

- Scene 3 — resolve to lockup (~Ys–end): the lockup completes and holds (Product_Intro / Brand_Outro) or is flown into / extended to a CTA (CTA variants).
  - _Variant — Product_Intro (the ONE camera move)_: the whole system smoothly TILTS from flat top-down into an angled isometric perspective (ease-in-out) with a slight zoom-out — flat shapes become luminous 3D forms, bands become glowing orbit lines, while the central `[logo mark]` does NOT tilt (stays 2D, front-facing, fixed). Camera eases to a stop; elements keep continuous orbit/drift (inner faster than outer); the mark holds its steady glow. Final settled frame.
  - _Variant — CTA push (the signature)_: a single fast CAMERA PUSH-THROUGH the mark's negative space / through the glass pill — heavy horizontal motion-blur, giant `[CTA]` letters streaking past the lens (cursor drops out). Resolves to the final lockup on a saturated `[bg]`: a `[url badge]` / `[CTA line]` revealed by a left→right WIPE carrying an `[accent]` leading edge (or a clean fade), with solid mark-shapes parallax-sliding in behind. Settles to a dead-static hold (slow zoom-out / settle).
  - _Variant — CTA button-build_: the `[wordmark]` BUILDS letter-by-letter to the right of the slash, landing on the final "`[slash] [WORDMARK]`" lockup centered on the new bg. Slow settle to static.
  - _Variant — Brand_Outro_: the `[wordmark]` reveals beside the drawn mark (slide / fade) to complete the `[lockup]`; the lockup holds, then fades to `[black / bg]`.
  - _Variant — Product_Intro parts-assembly (the payoff beat)_: the finished lockup holds while a bottom `[subtitle box]` steps through `[tagline fragments]` (swap-in-place); or a big `[count-up stat]` line lands over a faint background asset grid; or the lockup scales-down / fades and a `[product UI window]` scales up on the flat bg (its panel content may swap once). The build hands off to product proof.
  - _Variant — CTA text-clear bloom_: the mark slides a short distance LEFT while the `[wordmark]` reveals to its right (letter-by-letter / slide-out wipe with visible partial states); the balanced "`[mark] + [wordmark]`" lockup centers and holds, one member continuing an almost imperceptible slow scale-up through the hold.
  - _Variant — Brand_Outro morph-chain_: the mark slides left as the `[wordmark]` is pulled out rightward trailing a motion-blur streak, the pair decelerating into the centered lockup (± a `[sub-line]` fades in below). The hold is LONG — dead static for the final ~40–50% of runtime.
  - _Variant — Brand_Outro parts-arrive_: the lockup rests centered and holds; or the full end card completes — a rounded-square `[icon tile]` scales up behind the mark, the `[title]` fades in word-by-word, and a bottom row (`[URL pill]` + `[store badges]`) fades / slides up — then holds static.
  - _Variant — Brand_Outro settled-reveal_: the `[tagline]` reveals left→right below the wordmark; the satellites finish drifting out and fade; the lockup holds centered (at most a very slow global zoom-out, no pan).

**motion vocabulary**: ring pulse / expand; background crossfade (light→dark); glow ignite; seed-dot scale-up; continuous orbit / drift (inner faster than outer); single 3D perspective tilt (flat→isometric) + slight zoom-out around a fixed 2D anchor; 3D logo assemble (part detach + spring dot, clapperboard hinge / snap, shell fan-out); wordmark cascade with overshoot (letters left→right); button pill rise / scale-in; animated stroke-outline DRAW + glow (button border AND logo mark); comet / spark accent; diagonal-band wipe (sweep → swell → collapse-to-slash); letter-by-letter wordmark build; pre-formed grid DISPERSE off all four edges; logo-mark stroke-draw (sequential arcs / segments); fast CAMERA PUSH-THROUGH with motion-blur (CTA spine); continuous slow push-in / push-out; cursor arc-in + click; parallax shape slide-in; left→right URL/badge wipe with glowing leading edge; static / fade-out end-lockup hold; optional idle breathe on the held mark; glowing-dot circular path trace; part-overlap icon completion (semi-circles scale up + overlap); scale-up-with-rotate mark entrance; wordmark slide-out-from-behind-icon; badge pill pop onto the lockup; stepped subtitle swap-in-place (bottom rail); count-up stat tick over a faint asset grid; lockup shrink / fade → UI-window scale-up payoff; word-by-word staggered fade-through-grey (in, and left-first out); rolling word-by-word line swap; shrink-toward-center + fade clearing exit; whole-mark spring BLOOM from zero (overshoot + slight rotation); near-imperceptible continuous scale-up through the hold; vertical slot-machine word swap; horizontal phrase collapse / wipe into the mark; instant same-center text→icon swap; line-panel fan-and-flip morph around a central pivot with motion blur (page-flip feel); interlock-settle into the geometric mark; wordmark pull-out trailing a motion-blur streak; lead-line slide-down-off-bottom exit; icon drop-in from above; sequential per-letter slide-in + terminal punctuation landing; confetti burst pop-then-instant-shrink; pixel-stack pop at a text edge; horizontal streak-stretch into full-width stripes; stripe-tail retraction absorbed into the mark (mask retraction); rounded-tile scale-up enclosing the mark; bottom metadata row fade / slide-up (URL pill + store badges); satellite shapes outward drift + fade; left→right underline sweep; left→right tagline wipe-in.

**rule mapping** (per motion verb → `rules/<id>.md`)

- ring pulse / expand from center → `center-outward-expansion` (radiate from a shared center; reuse the 0→1 progress driver)
- background crossfade (light→dark gradient) → plain opacity/background tween via `gsap-effects` (no dedicated rule needed)
- glow ignite on the mark → `asr-keyword-glow` (envelope-driven glow on the brand element)
- seed-dot scale-up into shapes → `spring-pop-entrance` (scale-in pop; alt `scale-swap-transition` if dots morph into shapes)
- continuous orbit / drift around fixed center → `orbit-3d-entry` (flip-in then continuous elliptical orbit; center label = the fixed mark)
- single 3D perspective tilt (flat→isometric) + slight zoom-out → `multi-phase-camera` (scripted scale phases on a scene-wrapping camera, for the zoom-out) — see camera modifier; the FLAT→ISOMETRIC plane tilt of the whole stage is a CSS-3D perspective move (`techniques.md` CSS-3D, animating the stage's `rotateX`) — no exact camera rule for the plane-tilt, approximate via CSS-3D (closest reference is `orbit-3d-entry`'s "Tilted orbit plane" variation animated over time)
- fixed 2D anchor logo amid moving universe → no motion rule needed (static anchor; intentional — it's the absence of motion, the universe moves around it)
- 3D logo assemble — part detach + spring dot → `spring-pop-entrance` (spring pop, `back.out` overshoot)
- 3D logo assemble — hinge open / snap (clapperboard) → `hacker-flip-3d` (the 3D-rotate axis) + `techniques.md` CSS-3D (the elastic open-and-snap-shut hinge is an adaptation of the 3D-rotate)
- 3D logo assemble — shell fan-out to edges → `center-outward-expansion` (run outward from the mark center)
- wordmark cascade with overshoot (letters left→right) → recipe `gsap-effects` (per-element staggered slide) + `spring-pop-entrance` (the `back.out` overshoot per letter)
- button pill rise / scale-in → `spring-pop-entrance` (scale-in; alt `scale-swap-transition`)
- animated stroke-outline draw + glow (button border) → `svg-path-draw` (stroke-dashoffset draw) + `asr-keyword-glow` (the glow on the drawn stroke)
- comet / spark accent on button → `asr-keyword-glow` (small glow accent); motion path via `techniques.md` GSAP MotionPathPlugin (#9)
- diagonal-band wipe (sweep → swell → collapse-to-slash) → `techniques.md` clip-path reveal (#12, animate a `polygon(...)` diagonal across the frame; the swell-then-collapse-to-slash is the same clip-path reveal driven through grow→shrink keyframes)
- letter-by-letter wordmark build → `discrete-text-sequence` (smooth-slice / per-state build); recipe `gsap-effects` (typewriter / appending words)
- pre-formed grid disperse off all four edges → not a rule gap: a formation flying off-frame is an EXIT, and the pipeline forbids mid-video exits — the harness transition IS the exit (only the final frame may exit the stage). Treat this as transition-handled / final-frame-only rather than an in-scene motion rule. (If staged in-scene as a reveal-the-mark clear, it reuses `center-outward-expansion` run OUTWARD — center→target machinery interpolating formation→offscreen targets, out-easing.)
- logo-mark stroke-draw (sequential arcs / segments) → `svg-path-draw` (the canonical multi-segment stagger draw)
- wordmark slide / fade reveal beside drawn mark → `svg-path-draw` (its "brand-line fades in after stroke" tail) ; slide via `spring-pop-entrance`
- fast camera push-through with motion-blur → `multi-phase-camera` (a hard push phase) — see camera modifier; the heavy motion-blur streak itself → `motion-blur-streak` (directional velocity blur on the fast push-through)
- continuous slow push-in / push-out → `multi-phase-camera` (phase scale + drift)
- cursor arc-in + click on the wordmark → `cursor-click-ripple` (move → click → ripple); arc path via `techniques.md` MotionPathPlugin (#9)
- parallax shape slide-in behind lockup → `depth-scatter-assemble` (parallax depth slide-in of shapes at differing depths; pair with `3d-text-depth-layers` for the depth ordering)
- left→right URL / badge wipe with glowing leading edge → `techniques.md` clip-path reveal (#12, animate `inset()` left→right); the glowing leading edge → `asr-keyword-glow`
- static / fade-out end-lockup hold → no motion rule needed (terminal hold / opacity fade; intentional)
- idle breathe on held mark (optional) → `sine-wave-loop` (post-settle breathing)
- glowing-dot circular path trace → `svg-path-draw` (the traced circle draws on) + `techniques.md` MotionPathPlugin (#9) for the leading dot riding the path tip
- part-overlap icon completion / semi-circle scale-up → `spring-pop-entrance` (per-part scale-in; place parts at their final overlap positions from setup — the overlap IS the completed mark)
- scale-up-with-rotate mark entrance → `spring-pop-entrance` (add a rotation from-value to the pop)
- wordmark slide-out-from-behind-icon → recipe `gsap-effects` (x-slide) under a clip / overflow mask via `techniques.md` clip-path reveal (#12); z-order the icon above the sliding text
- badge pill pop onto the lockup → `spring-pop-entrance`
- stepped subtitle swap-in-place (bottom rail) → `discrete-text-sequence` (whole-state replacement at time thresholds); derive the windows via `dynamic-content-sequencing`
- count-up stat tick over a faint asset grid → `counting-dynamic-scale`; the faint grid is a plain opacity fade (no rule needed)
- lockup shrink / fade → UI-window payoff → `scale-swap-transition` (exit cluster shrinks + fades at center; window pops in with `back.out`)
- word-by-word staggered fade-through-grey (in / left-first out) → recipe `gsap-effects` (per-word staggered opacity + color tween). Deliberately a quiet FADE register — do NOT substitute `waterfall-entry` here; its binary-arrival doctrine is the wrong voice for this serif beat
- rolling word-by-word line swap → two overlapping `gsap-effects` word staggers at the same timeline position (old line out left-first, new line in left→right)
- shrink-toward-center + fade clearing exit → `scale-swap-transition` (its exit half; the entrance half is the bloom)
- whole-mark spring BLOOM from zero → `spring-pop-entrance` (single hero, `back.out` overshoot, slight rotation from-value)
- near-imperceptible continuous scale-up through the hold → no motion rule needed (one long linear micro-tween on the held lockup; intentional life-in-the-hold)
- vertical slot-machine word swap → `vertical-spring-ticker` (masked column, stepped tween — one word slot cycles, rest of the line fixed)
- horizontal phrase collapse / wipe into the mark → `scale-swap-transition` (same-center morph) with the collapse via `techniques.md` clip-path reveal (#12)
- instant same-center text→icon swap → no motion rule needed (`tl.set` hard swap; intentional — the chain's continuity lives in the NEXT beat's morph)
- line-panel fan-and-flip morph (page-flip, motion-blurred) → `hacker-flip-3d` (the per-panel 3D rotation axis) + `motion-blur-streak` (the blur) + `techniques.md` CSS-3D; true stroke-interpolation glyph morphs live in `hyperframes-keyframes` (SVG morph) — reach there if panels can't sell it
- interlock-settle into the geometric mark → `center-outward-expansion` machinery run INWARD (per-panel transform offsets tween to 0 in lockstep with one driver)
- wordmark pull-out trailing a motion-blur streak → `motion-blur-streak` (echo / ghost trail collapsing into the lead) on the x-slide
- lead-line slide-down-off-bottom exit → in-scene clearing beat; same doctrine as the grid-disperse row above (offscreen target + out-easing; prefer the harness transition when the exit IS the scene boundary)
- icon drop-in from above → `spring-pop-entrance` (y-offset from-value, overshoot on landing)
- sequential per-letter slide-in + terminal punctuation landing → `waterfall-entry` (staggered arrival cascade on a lateral axis; the punctuation is the cascade's final, heaviest beat)
- confetti burst pop-then-instant-shrink → `press-release-spring` ("release burst" variation) for a small deterministic burst; a true multi-particle confetti field → `particle-burst`
- pixel-stack pop at a text edge → `spring-pop-entrance` (tight stagger down the stack)
- horizontal streak-stretch into full-width stripes → plain `scaleX` stretch via `gsap-effects` (transform-origin at the stack) + `motion-blur-streak` for the streak read
- stripe-tail retraction absorbed into the mark → `techniques.md` clip-path reveal (#12) run in REVERSE (animated `inset()` retraction reading as mask absorption into the mark)
- rounded-tile scale-up enclosing the mark → `spring-pop-entrance` (scale-in BEHIND the mark; z-order only, mark never moves)
- bottom metadata row fade / slide-up → `spring-pop-entrance` (staggered group, ≤500ms cap)
- satellite shapes outward drift + fade → `center-outward-expansion` run OUTWARD (drift targets past frame edge) + opacity tail; if the drift must idle first, seed it with `sine-wave-loop`
- left→right underline sweep → `css-marker-patterns` (highlight sweep re-skinned as an underline) or `stat-bars-and-fills` progress-fill `scaleX`
- left→right tagline wipe-in → the existing "left→right URL / badge wipe" row applies unchanged (clip-path `inset()`)

**camera modifier** (the push / tilt)

- **CTA push-through** (the CTA spine): a scripted hard zoom phase on a scene-wrapping camera → `multi-phase-camera` ("Steady push" / "Bookend pull" pattern; push phase = the climax). When the mark is OFF-center and the camera must fly through a specific point of negative space, combine with `coordinate-target-zoom` (outer scales, inner counter-translates so the target negative-space point lands at viewport center as scale ramps; measure the offset at setup). The signature heavy horizontal MOTION-BLUR on the streak → `motion-blur-streak` (directional velocity blur on the push); realize with a CSS `filter: blur()` / duplicated-streak layer on the camera during the push window.
- **Product_Intro tilt** (the one cinematic move): the flat→isometric perspective tilt + slight zoom-out is a single scripted camera beat → `multi-phase-camera` (scale phase + the "Targeted zoom into off-center element" / drift machinery) for the zoom-out. `multi-phase-camera` is scale+translate+drift only, so the perspective-PLANE rotateX (flat top-down → angled isometric) of the whole stage is the CSS-3D move noted above — approximate via `techniques.md` CSS-3D, animating the stage's `rotateX` (closest reference is `orbit-3d-entry`'s "Tilted orbit plane" variation animated over time).
- **Static-frame variants**: the parts-assembly, text-clear bloom, morph-chain, parts-arrive, and settled-reveal variants are all COMPLETELY static-frame (element-level motion only; settled-reveal tolerates at most a very slow global zoom-out). The camera modifier applies only to the CTA push and the Product_Intro tilt.

## Selected motion rule: center-outward-expansion

---
name: center-outward-expansion
description: Elements start clustered at screen center and expand outward to their final positions, driven by a shared progress value.
metadata:
  tags: expansion, scatter, center, reveal, layout, sync, burst
---

# Center-Outward Expansion

Elements begin at one shared center point and radiate outward to their final positions — the entry beat itself, or motion driven by another animation's progress (a counting number, a beat). Flat 2D cousin of [depth-scatter-assemble.md](depth-scatter-assemble.md) (per-element 3D cloud): here every element shares the SAME origin.

## How It Works

Each element carries its final offset as `data-target-x/y`. Its position lerps between center and target: `x = targetX × progress`. Self-centering is baked as `xPercent/yPercent: -50` so the tweened `x`/`y` are pure offsets from the stage center. Standalone burst = per-item staggered `fromTo`; driven burst = one shared proxy (see Variations).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="burst-wrap">
  <div class="burst-item" data-target-x="-360" data-target-y="-180">{itemA}</div>
  <div class="burst-item" data-target-x="360" data-target-y="-180">{itemB}</div>
  <div class="burst-item" data-target-x="0" data-target-y="360">{itemC}</div>
</div>
```

```css
.burst-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.burst-item {
  position: absolute;
  top: 50%;
  left: 50%; /* GSAP xPercent/yPercent -50 bakes the centering; x/y tween the offset */
  will-change: transform;
}
```

```js
document.querySelectorAll(".burst-item").forEach((el, i) => {
  tl.fromTo(
    el,
    { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.6, opacity: 0 },
    {
      x: Number(el.dataset.targetX),
      y: Number(el.dataset.targetY),
      scale: 1,
      opacity: 1,
      duration: EXPAND_DUR,
      ease: EXPAND_EASE,
    },
    ENTRY_AT + i * STAGGER,
  );
});
```

## Variations

- **Synced to a driver (chord)**: when the burst shadows a counter / beat, drop the stagger and drive all items from ONE 0→1 proxy tween with the driver's exact duration AND ease; `onUpdate` writes `translate(-50%,-50%) translate(targetX*p, targetY*p)` per item — the two read as one beat.
- **Partially-spread start**: with 6+ items the full cluster piles up — start from `{ x: targetX * START_PROGRESS, ... }`.
- **Idle micro-float**: hand off to [sine-wave-loop.md](sine-wave-loop.md) after landing instead of freezing.

## Values

| token          | range                | notes                                                            |
| -------------- | -------------------- | ---------------------------------------------------------------- |
| ITEM_COUNT     | 3–8                  | > 8 = visual chaos mid-expansion; low counts want wider spread   |
| EXPAND_DUR     | 1.0–1.8s             | must equal the driver's duration in the synced variant           |
| EXPAND_EASE    | `power3.out` default | `power2.out` gentler, `expo.out` dramatic stop; NEVER `in` eases |
| STAGGER        | 0.04–0.08s           | tighter = chord; looser = lazy arpeggio                          |
| ENTRY_AT       | 0–0.5s               | a beat of compositional quiet before the burst                   |
| START_PROGRESS | 0–0.5                | 0 = dramatic full cluster; ~0.3 avoids the pile-up               |

## Critical Constraints

- **Tween `x`/`y` over the baked `xPercent/yPercent: -50`** — mutating `left`/`top` fights the centering and causes pixel jitter.
- **Out-easing only** — `in` easings read as items being sucked back mid-air.
- **No other absolute-positioned siblings inside `.burst-wrap`** — they'd steal the centered baseline.
- **❗ The burst IS the beat** — don't park a "real headline" label below it (the eye snaps to the label and ignores the burst). If a label is needed, reveal it post-burst in the same stack.
- Synced variant: identical duration + ease as the driver, or the chord falls apart.

## See also

`counting-dynamic-scale` (the classic chord driver) · `depth-scatter-assemble` (3D per-element cloud) · `card-morph-anchor` (burst out of a morphed card) · `sine-wave-loop` (post-landing life).

## Selected motion rule: gradient-text-sweep

---
name: gradient-text-sweep
description: A gradient tweened THROUGH letterforms — background-clip:text + a backgroundPosition tween. Three forms: a continuous horizontal sweep inside a held headline, a traveling word-to-word highlight, and a hue-sweep that settles to a solid. Glyphs never move; finite, deterministic, seek-safe.
metadata:
  tags: gradient, text, sweep, background-clip, highlight, hue, typography, headline
---

# Gradient Text Sweep

Color that lives **inside the glyphs**: the headline's fill is an oversized gradient clipped into the letterforms (`background-clip: text`), and the motion is the gradient sliding **through** the type — the letters never move. Three forms: a **continuous sweep** across a held title card, a **word-to-word highlight** that lights a line left→right, and a **hue-sweep** that settles to a solid.

Boundaries: [asr-keyword-glow.md](asr-keyword-glow.md) is word-timed emphasis railed to ASR timestamps — this rule is a design beat with no audio rail. [ambient-glow-bloom.md](ambient-glow-bloom.md)'s traveling sweep is a sheen riding **over a surface**; here the gradient is masked **into the type** (its "Shimmer sweep" variation is this mechanism re-aimed as a working-state loop). [css-marker-patterns.md](css-marker-patterns.md) draws accents _around_ text, never fills.

## How It Works

The text carries a gradient background **wider than its own box** (`background-size: SWEEP_SPAN 100%`, e.g. `300% 100%`) clipped into the glyphs, so tweening `backgroundPosition` slides the gradient through the visible letterforms. Two gotchas own this rule:

- **`background-position` percentages only produce travel when `background-size` exceeds 100%** — at 100% the image is pinned and the tween is a silent no-op.
- **The percent axis runs opposite to the perceived travel** — tweening `"100% 50%"` → `"0% 50%"` moves the highlight left→right through the text.

1. **Continuous sweep (held title card)** — one long **linear** `backgroundPosition` tween spanning the hold. First and last color stops equal, so the travel has no visible seam and reads as endless while remaining a single finite tween.
2. **Word-to-word highlight** — each word is two pixel-identical stacked copies: a base copy in the resting color and a gradient-clipped copy at `opacity: 0`. A per-word opacity envelope (rise, then fall as the next word rises) passes the highlight along on an index-derived stagger — an **envelope, not a moving mask**: no per-word position measurement.
3. **Hue-sweep → solid** — the gradient holds position while a `filter: hue-rotate()` tween sweeps its hues; the settle is a stacked-copy crossfade to a solid twin — never a color-stop tween (gradients with different stops don't interpolate reliably).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<!-- Forms A/C: gradient headline; solid twin behind for the Form C settle -->
<div class="headline-stack">
  <h1 class="headline solid-twin">{headlineText}</h1>
  <h1 class="headline gradient-fill" id="headline">{headlineText}</h1>
</div>

<!-- Form B: per-word stacked copies -->
<p class="line">
  <span class="word"><span class="w-base">{word1}</span><span class="w-hot">{word1}</span></span>
  <span class="word"><span class="w-base">{word2}</span><span class="w-hot">{word2}</span></span>
</p>
```

```css
.headline-stack,
.word {
  display: grid; /* twins share one cell — pixel-identical boxes */
}
.headline,
.w-base,
.w-hot {
  grid-area: 1 / 1;
}
.gradient-fill,
.w-hot {
  background-image: {gradient}; /* {sweepGradient} A/C, {highlightGradient} B */
  background-size: SWEEP_SPAN 100%; /* MUST exceed 100% or the position tween is dead */
  background-position: 100% 50%; /* start; tween toward 0% for left→right travel */
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.solid-twin {
  color: {settleColor};
}
.w-base {
  color: {restColor};
}
.w-hot {
  opacity: 0; /* the envelope raises it as the highlight passes */
}
```

```js
// Form A: continuous sweep. 100% → 0% reads left→right (percent axis inverted);
// ease "none" — an eased sweep reads as an object, not light.
tl.fromTo(
  "#headline",
  { backgroundPosition: "100% 50%" },
  { backgroundPosition: "0% 50%", duration: SWEEP_DUR, ease: "none" },
  SWEEP_START,
);

// Form B: traveling highlight — per-word rise/fall envelopes, index stagger.
gsap.utils.toArray(".w-hot").forEach((el, i) => {
  const at = HIGHLIGHT_START + i * WORD_LAG;
  tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: HOT_RISE, ease: "power2.out" }, at);
  tl.to(el, { opacity: 0, duration: HOT_FALL, ease: "power2.in" }, at + WORD_LAG);
});

// Form C: hue-sweep, then crossfade to the solid twin (never tween color stops).
tl.fromTo(
  "#headline",
  { filter: "hue-rotate(0deg)" },
  { filter: `hue-rotate(${HUE_RANGE}deg)`, duration: HUE_DUR, ease: "power1.inOut" },
  HUE_START,
);
tl.to(
  "#headline",
  { opacity: 0, duration: SETTLE_SNAP_DUR, ease: "power2.in" },
  HUE_START + HUE_DUR,
);
```

## Variations

- **Title-card crawl** — Form A stretched across a long terminal hold (3–8s end card): seamless-ended gradient, `ease: "none"`, `SWEEP_DUR` = the whole hold. One tween, no loop.
- **One-pass sheen inside type** — gradient is the resting fill everywhere except one narrow highlight band (≤ ~25% of the span); one `backgroundPosition` pass carries the band through and the text returns to rest with no crossfade.
- **Karaoke settle** — Form B with the fall tweens skipped: the line lights cumulatively left→right and holds fully lit; settle color = the hot state, base copies start dimmer.
- **Gradient climax word** — one emphasized word (often ~-8° rotated) carries the gradient while the line stays solid; static gradient + a short Form C hue shift on landing, settling to the brand accent. Pairs with a `kinetic-beat-slam` arrival.

## Values

| token               | range                  | notes                                                                                |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| SWEEP_SPAN          | 200–400%               | must exceed 100%; wider = softer/slower feel, narrower = busier color per glyph      |
| SWEEP_DUR           | 1.2–3s                 | match the card's hold exactly; slower than ~4s stops registering as motion           |
| WORD_LAG            | 0.25–0.5s              | HOT_FALL starts exactly WORD_LAG after the rise so envelopes cross — a gap = a blink |
| HOT_RISE / HOT_FALL | 0.15–0.3s / 0.25–0.45s | fall slightly longer — the highlight "trails"                                        |
| HUE_RANGE / HUE_DUR | 40–180° / 0.8–1.6s     | past ~180° the palette dissociates from itself mid-sweep                             |
| SETTLE_SNAP_DUR     | 0.1–0.35s              | the goldens snap (~0.15s)                                                            |
| {settleColor}       | —                      | one of the gradient's own stops (or the brand ink) so the settle reads as resolution |

## Critical Constraints

- **`background-size` > 100%** on any element whose `backgroundPosition` is tweened — otherwise the tween is a silent no-op.
- **Percent axis is inverted** — left→right perceived travel is `100% → 0%`.
- **Both `-webkit-background-clip: text` AND `background-clip: text`, with `color: transparent`** — missing the prefix renders a solid gradient block over the text in the capture browser.
- **`ease: "none"` on position sweeps** — this is supposed to read as light, not an accelerating object.
- **Seamless ends for a crawl** — first and last stops equal, or the wrap point flashes a hard edge mid-hold.
- **Stacked copies pixel-identical** — same box, font, weight, tracking, one grid cell; any metric drift makes the crossfade a double-exposure.
- **`data-layout-allow-occlusion` on the twin** — pixel-identical stacked copies trip `hyperframes check`'s `text_occluded` gate by construction; the flag is the sanctioned waiver for this mechanism.
- **Settle by crossfade, never by tweening stops**; and the glyphs never move — if the type must travel, that's a separate rule on the wrapper.
- **No CSS `@keyframes` shimmer** — wall-clock animation desyncs from seek; every sweep is a timeline tween.

## See also

`kinetic-beat-slam` (slam lands the climax word, hue settle finishes it) · `spring-pop-entrance` (pop in solid, sweep after) · `discrete-text-sequence` (swap-slot under a riding crawl) · `ambient-glow-bloom` (surface-level sibling) · `css-marker-patterns` (strokes around text; fills here).
