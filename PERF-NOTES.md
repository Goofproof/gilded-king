# PERF-NOTES - canvas optimization program (2026-07-16)

## Research brief (sourced, no wheel inventing - Sam's rule)

Sources: MDN "Optimizing canvas" (developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas),
web.dev "Improving HTML5 Canvas performance" (web.dev/articles/canvas-performance),
Konva.js Shape Caching doc (konvajs.org/docs/performance/Shape_Caching.html),
Nicola Hibbert "Optimising HTML5 Canvas games", jaredwilli perf gist.

Practices adopted:
1. Pre-render expensive/static drawing ONCE to an offscreen canvas; per frame just
   drawImage it (MDN #1, Konva's core model).
2. Keep sprite caches SNUG - loose caches pay dead-pixel copy cost every frame
   (web.dev benchmark). Full-room cache at exactly canvas size is fine.
3. NEVER shadowBlur in the frame loop - bake glows to sprites at build time (MDN).
4. Integer draw coordinates everywhere, including the shake offset (sub-pixel
   positions force filtering).
5. Batch same-styled draws; minimize fillStyle/font churn.
6. Text is expensive - cache static text, keep live counters dynamic.
7. Dirty rectangles: REJECTED here - global screen shake dirties every frame.
8. Layered canvases (separate background element): REJECTED - the world-layer
   screen shake would need a per-frame CSS transform on the second canvas that
   must agree with ctx.translate to the device pixel (seams/swimming), and it
   forfeits alpha:false on the main surface. The offscreen room cache captures
   the same win inside one canvas. Revisit only if shake is ever removed.

## Shipped

- Tier 1 (v2.125): particle cap 600, fps-independent trails, projectile glow
  sprites, cached vignette/shroud/trinket gradients, squared-distance hit tests,
  worm-scan hoist, idle-host broadcast gate. Stress bench 1.903 -> 1.393 ms/frame.

## Tier 2 shipped (v2.126)

- drawRoom static-layer cache: full room (walls/grid/details/slabs/speckles/pits/
  static obstacle themes incl. their shadowBlur glows) baked once per room to
  room._staticCv, one drawImage per frame. Live: ambient Fx spawners, doors
  (lock state), the 7 Date.now() animated obstacle themes, chests/portals/NPCs.
- Minimap offscreen cache keyed floor|visited|cleared|seeAll|rules|swarm/crown;
  live: score/label at mapAlpha, current-room box, oracle star pulse.
- Particle draw: lastStyle tracking + fillRect for sub-2.2px particles
  (painter's order + per-particle alpha preserved).
- Benchmarks (dev box): HEAVY 1.903 -> 1.393 (t1) -> 1.098 ms/frame (-42%
  total); LIGHT 0.864 -> 0.630 (-27%). Weak-GPU gains larger (blur/gradient
  elimination dominates there).
- ACCEPTED COST: the 7 animated obstacle themes (flamewall, tomb, wheel, plume,
  reed, brazier, orrery) still draw live shadowBlur on their floors - one theme
  per floor, bounded; baking them quantizes their animation (verifier finding).
  Revisit only if a specific floor still lags in playtest.

## Superseded plan (tasks #56-#59)

- T2a: drawRoom static-layer cache (room+floorNum keyed offscreen; ambient Fx
  spawners/doors/Date.now obstacles stay live).
- T2b: glowing obstacle decor baked (flamewall stays live-deformed, blur dropped).
- T2c: minimap offscreen cache + HUD static/dynamic text split.
- T2d: particle batch draw + final benchmark.

Benchmark recipe (dbg harness): floor 9 combat, 800 burst particles, 8 zones,
60 glowing projectiles, 300 dbg.step(1/60); report ms/frame. History: 1.903
(pre), 1.393 (tier 1).
