# Rank Plaque Design Handoff

Last updated: September 9, 2026.

This document records the user's design decisions and the current implementation at the end of the initial design pass. It is intended to let another session continue refinements without rediscovering the visual direction. All six designs have an implementation in `Dev/src/`; none should be treated as visually finished. Preserve the accepted concepts and ask before substantially replacing one.

## Shared layout and design rules

- The central identity assembly occupies a fixed rectangle. Do not enlarge that rectangle or move the neon username to accommodate a plaque.
- The neon username stays in its existing position above the assembly. The title sign hangs beneath it, and the rank plaque hangs beneath the title sign. The metal connectors remain between the components.
- The old neon border surrounding the middle card has been removed, including its ambient overlay and inner padding. The title sign and rank plaque now use the available rectangle directly.
- The title sign is deliberately shorter so the rank plaque gets more height. The gap between them was halved, with the recovered space assigned to the rank plaque. The title sign was then reduced another approximately 12.5% from its previous height.
- The small word TITLE uses a narrower, lighter font, at 80% of its original label size. It is on the top edge of the title sign, not in the gap beneath it.
- The rank title means the actual name, such as Dry Clay or Fully Bricked. RANK is the small category label. The title sign below the username displays the player's selected stat title; do not confuse that with the rank title.
- Plaque designs must fit their allocated space in compact, expanded, and page modes. Comfortable padding matters more than retaining a fixed font size. Longer atrophy names must be checked individually.
- Preserve the established text styling unless the user has explicitly requested an exception. The exceptions so far are the first tier's black text, the emerald's physical cutouts, and the gold crown's engraved plaque lettering.
- The progress-bar labels are separate from the large rank plaque. Most retain their earlier styling even when the plaque design changes. See individual tiers below.
- The visual progression should increase in quality and spectacle: plastic badge, illuminated sign, polished steel shield, carved emerald, royal gold crown, pearl premiere marquee.
- New animation must respect the existing shared entrance delay and the animations-off setting. Do not introduce perpetual startup flickering.

## 1. Plastic name badge

**Names:** Dry Clay / Parched Clay / Cracked Clay.

**Direction:** An inexpensive but physical white plastic name badge, inspired by the familiar Hello, my name is label. The original black oval usher badge concept was replaced by this white badge.

### Accepted appearance

- Rounded rectangular white/off-white plastic body.
- Red greeting strip across the top reading exactly `Hello, my RANK is...` on one horizontal line.
- The full rank name is also a single horizontal line beneath the greeting. Do not return to stacked Dry / Clay text.
- Rank-name text is black on both the plaque and the rank progress bar. Its former gray color and dark shadow were removed.
- The greeting uses a softer, lighter font than the original bold Arial attempt. Current stack: Trebuchet MS, Segoe UI, sans-serif.
- Subtle surface sheen, a molded rim, and lower-edge thickness give the badge a plastic rather than paper appearance.
- Compact mode has smaller rank lettering and a thinner rim. The user specifically found the initial compact text unreadable and the border too bulky.

### Refinement priorities

Keep both lines legible, especially in compact mode. Preserve the simple low-tier feel while retaining enough edge shading to read as plastic. Do not add the expensive lighting or ornament used by later tiers.

## 2. Fluorescent illuminated sign

**Names:** Moistened Clay / Saturated Clay / Dripping Wet Clay.

**Direction:** A small illuminated billboard/lightbox that starts up like a fluorescent fixture. The first mostly charcoal, plain rectangular lightbox was rejected as too plain.

### Accepted appearance

- A smoky charcoal face is acceptable, but the whole object must not be charcoal.
- The rank name is the central feature. Keep it centered in the available face, clear of the enlarged top label area.
- Names remain on two deliberate lines: Moistened / Clay, Saturated / Clay, Dripping Wet / Clay.
- The lettering retains its illuminated treatment and startup flicker.
- The border itself lights up in the same cool white as the text. The temporary mint-colored border was replaced with the text's cool white palette.
- The border emits light outward. The user asked for this glow to be softened after its first implementation; preserve the reduced intensity rather than restoring the original strong halo.
- RANK is large, unlit lettering directly on the top border. No pill, backing tab, or separate box surrounds it.
- The top border smoothly widens downward around RANK. Elsewhere, the border is about half the thickness of that label-bearing area. This curved widening is a deliberate part of the sign's personality.
- Avoid a second thick outside border. A fine, size-scaled bevel supplies physical depth without cutting into the RANK label, especially in compact mode.
- RANK should fill its allotted band as much as possible while remaining centered and clear of its edges. Its capital-letter height is used for optical centering rather than relying only on the font's line box.

### Startup sequence

The text, illuminated border, and outward glow use synchronized keyframe times:

1. Keep the existing shared animation delay unchanged.
2. Stay off for the initial 30% of the 2.5-second animation: approximately 0.75 seconds after that delay.
3. Begin weak flashes at 30.01%, 38%, and 44%, with off states at 33%, 40%, and 45%.
4. Attempt a longer, brighter ignition at 53%, then fail at 64%.
5. Flash again at 72%, drop out at 74%, and settle fully on at 76%.
6. Remain steadily lit thereafter. This is a startup sequence, not a repeating flicker loop.

Current outward-glow steady-state layers are 4px/.38, 8px/.20, and 14px/.08 with the existing cool-white RGB colors. These are implementation reference values, not a mandate against later tuning. Keep the user's preference for a soft halo.

### Refinement priorities

Verify label centering and edge thickness in compact mode, keep the curved top widening smooth, and maintain synchronization if any startup timing changes. The user liked the overall direction after these revisions.

## 3. Polished steel shield

**Names:** Hand-Jerked Clay / Foot-Pumped Clay / Vacuum-Milked Clay.

**Direction:** A regal polished-steel nameplate. The accepted silhouette is now a shield, not the earlier cartouche/scroll shape.

### Accepted appearance

- Broad, defined shoulders with a small raised central crest.
- Smooth sides taper into one centered bottom point.
- RANK is engraved in the top crest/border.
- A bright, reflective steel bevel surrounds a darker polished-steel interior.
- The actual rank name retains its existing metallic styling, including the established letterform treatment. Fit longer atrophy names comfortably.
- The border has layered metalwork, but its engraving should be orderly and restrained.
- Earlier overlapping scrollwork was replaced with a single clean engraved outline. Do not reintroduce intersecting curls or multiple competing outlines near the bottom point.
- The original angular polygon looked choppy to the user. Smooth, deliberate curves are essential; avoid a star-like or wobbly perimeter.

### Status

The user explicitly accepted the shield version: “this is the one,” with detailed adjustments deferred. Refine this shield rather than reverting to the earlier shape.

## 4. Polished emerald with through-cut rank lettering

**Names:** Pit-Fired Clay / Scove-Fired Clay / Kiln-Fired Clay.

**Direction:** A cut, polished, glass-like emerald block from which the rank letters have been physically removed. Imagine those extracted emerald letters becoming the lettering on the progress bar below.

### Essential requirements

- The crystal must read as translucent emerald/glass, not opaque green metal or a plate with simple green gradients.
- The rank title is a set of holes all the way through the crystal. The actual background must be visible through the letters.
- Do not render ordinary filled text in a recessed viewing window. Do not replace the holes with dark text that merely imitates transparency.
- Plain text-shaped transparency alone is also insufficient. The walls around the openings should show thickness, rounded/repolished edges, green internal reflections, and narrow highlights.
- The cutouts should look like the crystal was cut and then polished again, not simply punched from paper.
- Outer facets should have deliberate, sharp reflections and a glass-like variation in transparency.
- The rank progress-bar text keeps its existing emerald appearance, supporting the idea that it was extracted from this block.
- RANK currently appears as a small stamp on the upper facet. Its final treatment was never firmly settled; this remains open for refinement.

### Current implementation and limitations

The plaque is an inline SVG with transparent text masks, translucent green body gradients, outer facets, and thin layered strokes around the letter openings. The first version was rejected for looking like ordinary lettering on a solid, simply textured plate. The second version enlarged the openings, reduced the thick letter rims, and introduced translucent glass faces and finer reflections.

The user said the revised version was getting closer but chose to leave it alone for now. They are uncertain whether CSS-style effects alone can achieve the desired material and may rethink the approach. This is the least settled material treatment. Do not claim the current implementation fully achieves the intended emerald realism, and do not undertake another major redesign without discussing the approach.

## 5. Extravagant gold crown

**Names:** Half Bricked / Mostly Bricked / Competently Bricked.

**Direction:** A luxurious gold nameplate shaped like a crown, visibly more ornate and dimensional than every earlier tier.

### Accepted appearance

- A crown silhouette with five raised points, rounded gold finials, and layered bevels.
- Strong polished-gold highlights, darker side/underside edges, and a curved lower band create visible thickness.
- Restrained engraved flourishes and small gold ornaments add richness.
- The rank title is centered in the crown body.
- RANK is engraved in the bottom band, not above the crown.
- The initial recessed viewing window behind the rank title was removed at the user's request. The crown is continuous gold behind the lettering.
- The rank title now looks engraved directly into the gold: dark warm lettering with a fine highlighted edge. The plaque-specific glowing text treatment was disabled for this engraving.
- The gold text on the rank progress bar retains its original styling; the engraving change applies only to the crown plaque.

### Status

The user called the first crown “actually amazing,” then requested removal of the viewing window. This is an accepted design with refinements deferred. Preserve its crown silhouette, gold dimensionality, and direct engraving.

## 6. Fully Bricked premiere marquee

**Name:** Fully Bricked only.

**Direction:** A name in shining lights: exuberant, colorful, theatrical, and the most impressive plaque of the entire progression.

### Accepted concept and current appearance

- A wide premiere marquee with sweeping shoulders and a small star crest at the top.
- A polished iridescent pearl frame using pink, cyan, lavender, white, and champagne colors.
- Individually recessed lights trace the perimeter. Their bright centers and colored halos distinguish them from a continuous neon tube.
- A deep midnight-violet center provides contrast for the existing pearl/iridescent Fully Bricked lettering. The title remains the focal point.
- Two small spotlight fixtures are built into the lower corners and point diagonally upward across the face.
- The beams give a physical source for the reflective lighting effects on the lettering and frame.
- RANK sits in a small pearl ribbon/band at the bottom.
- Layered perimeter edging, light sockets, the star, spotlight housings, and the lower ribbon give the object depth and ornament.

### Motion

- The current entrance lights perimeter bulbs in mirrored pairs, progressing outward/downward from the upper region, with 45ms between pairs and a short fade for each pair.
- The spotlights rise after the bulbs begin lighting, using the existing shared animation delay plus a 650ms offset.
- Existing iridescent text animation continues after the entrance.
- When animations are disabled, the lights and beams remain visible in their steady state.
- The earlier concept also mentioned occasional bulb glints and slow pearl-frame shimmer. Those are possible refinements, not completed features; the current implementation does not have a separate ongoing bulb-glint or frame-shimmer animation.

### Status

The user really likes this first implementation and expects many later refinements. Preserve the premiere marquee concept. Tune the balance of color, pearl material, bulbs, beam intensity, depth, and legibility rather than replacing its identity.

## Implementation map for the next session

- Source of truth: files under `Dev/src/`. Never edit `Dev/BBGLDev.js`, `Dev/BBGLRelease.js`, or root `BigBlackGymLog.js` by hand.
- `Dev/src/06-section-v-logic.js`: `achRankPlaqueHTML()` routes the plaque-specific decorations; `achEmeraldPlaqueHTML()`, `achGoldCrownHTML()`, and `achPearlMarqueeHTML()` generate the inline SVG artwork. `achCurrentRankPlaqueData()` resolves the current finish/material. The title-card markup is also in this file.
- `Dev/src/04-section-iii-styles.js`: shared title-card geometry, existing progress-bar/text material treatments, and plaque-specific styles. Search for `.bbgl-title-card-rank-plaque.finish-...` rather than relying on line numbers.
- Finish mapping: `mill` = plastic badge; `machined` = fluorescent sign; `polished` = steel shield; `silver` = emerald; `gold` = crown; `pearl` = Fully Bricked marquee. Historical class names do not necessarily describe the new visual material.
- Material mapping: `iron`, `steel`, `silver`, `bright-silver`, `gold`, `diamond`, respectively. These govern established rank text treatments and are shared with progress-bar labels.
- Rank names and atrophy bands live in `Dev/src/03-section-ii-utils.js` under `LEVEL_TITLE_BANDS`.
- The shared renderer also supports dormant shelf plaques. Most of this work is scoped to the title-card plaque; do not accidentally alter other rank contexts while refining it.
- Other work already existed in the working tree throughout this session. Preserve unrelated edits; do not reset files to an earlier committed version.

## Verification and next steps

The development output was rebuilt after each implementation change and passed JavaScript syntax checking. That is not a substitute for visual verification. Most visual feedback came from the user's live app and screenshots; compact alignment and material quality require continued in-app inspection.

For the next refinement pass, inspect all three panel modes and every atrophy name. In particular, check long names against ornaments, the RANK label's optical centering, actual see-through emerald holes, and the brightness of marquee lighting. Preserve the fixed outer rectangle and stationary neon username throughout.
