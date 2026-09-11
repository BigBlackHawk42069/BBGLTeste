# BBGL Working Plan — Stat-Ratio Titles & Level Curve Rework

Status doc for two in-progress designs. Nothing in this document is live in the shipped script
except where explicitly marked "current code." The artifact sandbox is a design tool only.

---

## Part 1 — Level EXP Curve

### Current code (production, `Dev/src/03-section-ii-utils.js`)

| Parameter | Value |
|---|---|
| Curve shape | Linear + tail spike (two straight ramps, then power-3.5 tail) |
| Step 1 ends | 25% of levels, value 126 EXP |
| Step 2 ends | 80% of levels, value 250 EXP |
| Floor (tier start-level cost) | 25 |
| Max (level 99 cost) | 400 |
| A0 multiplier | 1.00 (fixed) · Lv 0→100 |
| A1 multiplier | 1.75 · Lv -1→100 |
| A2 multiplier | 2.50 · Lv -10→100 |
| Pre-Green rate (0–1,000E) | 0.175 EXP/E |
| Green+ rate (1,000–1,500E) | 0.200 EXP/E |
| Gold+ rate (1,500E+) | 0.225 EXP/E |
| Diamond flat bonus (2,000E+) | **None** |
| HJ burst rate (≤1,000E on HJ days) | 0.25 EXP/E |

The cost-curve shape/floor/max/multipliers/atrophy start-levels above are **not** being changed —
the sandbox artifact confirms them as-is. Only the EXP **earn-rate** past Gold is under discussion.

### Proposed change (design sandbox only — [BBGL Leveling Curve Tuner](https://claude.ai/code/artifact/b0cdc645-1681-4250-8c3f-f37fcb32ab71))

Idea: diminishing returns past 1,500E (Gold+), offset by a flat bonus for actually reaching
Diamond (2,000E) — a risk/reward tradeoff. Pushing past Gold only pays off if you go all the way;
stopping partway into the Gold+ band earns worse EXP/E than stopping exactly at Gold used to.

| Parameter | Current code | Proposed |
|---|---|---|
| Pre-Green rate | 0.175/E | 0.175/E (unchanged) |
| Green+ rate | 0.200/E | 0.200/E (unchanged) |
| Gold+ rate | 0.225/E | **0.050/E (confirmed)** |
| Diamond flat bonus (2,000E+) | none | **+100 EXP (confirmed)** |

Confirmed as the target snapshot: Gold+ drops all the way to 0.050/E, offset by the +100 flat
Diamond bonus at 2,000E+. This is a much sharper diminishing-returns cliff than the earlier 0.100/E
attempt — past 1,500E, EXP/E craters to less than a third of the Green+ rate, so the +100 bonus is
doing real work to make finishing to Diamond worth it at all. Not yet applied to the artifact or
the codebase — still a design decision recorded here first.

Full climb (0→100 through all 3 atrophy tiers) cost estimates under the **current code's** rates,
for reference:

| Daily pace | Total E required |
|---|---|
| Green (1000E/day) | 565,503 E |
| Green/Gold alternating | 549,794 E |
| Gold (1500E/day) | 539,798 E |
| Diamond (2000E/day) | 510,119 E |

(These will shift once the Gold+/Diamond-bonus rework is finalized — not yet recalculated.)

---

## Part 2 — Stat-Ratio Title System

Second, independent title system appended after the existing level-band title (e.g. "Dry Clay
Meathead"). Does **not** reset with atrophy — progresses linearly on its own track. Not started in
code yet; design-only so far.

### Decided

- **Structure — LOCKED IN (superseded the earlier offense/defense-axis split):** all 4 stats
  (Strength, Speed, Defense, Dexterity) are ranked directly against each other by current raw
  value. The title is built from whichever **2 stats actually rank highest**, in order — not
  restricted to "one offense stat + one defense stat." Torn stat semantics, confirmed by you:
  Strength = damage dealt, Speed = accuracy, Defense = damage resisted, Dexterity = evasion/dodge.
  - This restores the original 12-combination idea from the very start of this design (P(4,2) = 12
    ordered pairs from 4 stats) — e.g. Strength+Speed both being your top 2 (both offense-flavored)
    is now a valid title, which the old forced-axis-pairing would never have allowed.
  - It costs nothing extra over the (now-abandoned) offense/defense-axis version: every stat gets
    its own full noun+adjective word ladder regardless (see below), so the same 4 stats × (noun +
    adjective) = 8 words per phase generate all 12 possible ordered pairings for free, instead of
    needing 12 hand-written combo names.
  - Superseded idea, kept for history: the earlier design forced exactly one "offense word"
    (Strength/Speed winner) and one "defense word" (Defense/Dexterity winner), needing only 4
    combos. Abandoned once it became clear the per-stat word-ladder approach (built for word-order
    flipping anyway) already supports the full 12-combination version at the same cost.
- **Word-order rule — LOCKED IN:** whichever of the current top-2 stats has the higher raw value
  leads the phrase in its **adjective** form; the other follows in its **noun** form. E.g. if
  Strength and Dexterity are your top 2 and Strength > Dexterity: "[Strength adjective] [Dexterity
  noun]"; if Dexterity > Strength, it flips to "[Dexterity adjective] [Strength noun]." Same pattern
  for any of the 12 possible top-2 pairings.
- **Switch mechanism — LOCKED IN:** the displayed top-2 pairing (which 2 stats, and which order) is
  re-evaluated only at fixed cumulative-E checkpoints, every 10,000E (10k, 20k, 30k, ...):
  - At each checkpoint: if the actual current top-2 (as an ordered pair) differs from what's
    currently displayed, **and** that actual top-2 has held continuously for the prior 7 days,
    swap to it.
  - If either condition fails, skip that checkpoint entirely — no partial/early update. Wait for
    the next 10k checkpoint to re-check. (Confirmed: this can add up to ~10,000E of lag after the
    7-day stability is actually reached, and that's intended, not a bug to fix later.)
  - Note: this is a direct carry-over of the mechanism designed for the old offense/defense-axis
    version (which checked 3 things independently — offense winner, defense winner, order-flip).
    With the axis split gone, it's restated here as a single check against "the actual top-2 ranked
    stats, in order" — flagging this simplification explicitly in case a more granular version
    (e.g. checking "is stat X still in the top 2" separately from "which of the top 2 leads") was
    intended instead.
- **Phase (intensity) track — LOCKED IN:** separate from the word-slot combo logic above. Fires on
  its own cumulative-E schedule, unidirectional (only escalates). **10 tiers**, additive-increment
  design (each row is E spent *since the previous tier*, not cumulative):

  | Phase | Increment | Cumulative E |
  |---|---|---|
  | 0 | — | 0 (Basic title) |
  | 1 | 10,000 | 10,000 |
  | 2 | 15,000 | 25,000 |
  | 3 | 20,000 | 45,000 |
  | 4 | 25,000 | 70,000 |
  | 5 | 35,000 | 105,000 |
  | 6 | 50,000 | 155,000 |
  | 7 | 75,000 | 230,000 |
  | 8 | 100,000 | 330,000 |
  | 9 | 125,000 | 455,000 |
  | 10 | 150,000 | **605,000** |

  Target was ~600,000E as a final-tier flex; this lands at 605,000 with a clean, smoothly
  escalating increment curve (no single jarring jump anywhere in the sequence). Note this was
  chosen as a round target rather than tuned against a specific full-climb pace estimate — unlike
  the earlier 510k candidate, it wasn't matched to the Diamond-pace level-100 completion total, so
  it may land before or after max level depending on how the Gold+/diamond-bonus rework (Part 1)
  shakes out.
- **Category themes — LOCKED IN.** Each stat gets its own evolving noun+adjective word ladder,
  spanning all 11 stages (Phase 0 origin through Phase 10), that IS the phase-intensity
  progression — there's no separate modifier system layered on top; the phase index just picks
  directly into whichever stat's ladder is in play. Themes chosen to match what each stat actually
  does, not arbitrary:
  - **Strength** (damage dealt) → **Thug/criminal-rank escalation** — lone thug climbing toward
    real standing in a crew. Fits Torn's crime setting directly.
  - **Speed** (accuracy) → **Sharpshooter/sniper escalation** — bad aim maturing into precision.
  - **Defense** (damage resisted) → **Hardness/toughness escalation** — soft/untested toughening
    into something that can't be broken.
  - **Dexterity** (evasion) → **Ghost/elusiveness escalation** — easily caught becoming
    genuinely untouchable.
  - Tone: early stages lean into ambiguously-sexual/crime/gym humor (mascot is BigBlackHawk, "Big
    Black Cock," for the in-universe "Fully Bricked Fitness" gym — humor fits naturally here rather
    than being forced, same spirit as the existing "Hand-Jerked Clay / Foot-Pumped Clay /
    Vacuum-Milked Clay" atrophy band). Later stages expected to taper toward more evocative/serious
    language, but that taper point hasn't been reached yet in the word ladders below.
- **Word ladder foundation — IN PROGRESS.** Phases 0–5 locked in for all 4 stats; Phases 6–10 not
  yet decided (`<null>`). Every word must have both a working noun form and a genuine adjective
  form (a real suffix pair like Guard/Guarded, or a valid zero-derivation word like Savage/Ace that
  already works unchanged as both) — words with no natural adjective form (e.g. "Cub" → "Cubly")
  were explicitly rejected as unusable.

  | Phase | Form | Strength | Speed | Defense | Dexterity |
  |---|---|---|---|---|---|
  | 0 | Noun | Goon | Blindman | Softie | Noise |
  | 0 | Adj | Goonish | Blind | Flaccid | Noisy |
  | 1 | Noun | Fist | Peeper | Blister | Silence |
  | 1 | Adj | Fisting | Peeping | Hardening | Silent |
  | 2 | Noun | Pounder | Lurker | Firmness | Creeper |
  | 2 | Adj | Pounding | Lurking | Firm | Creeping |
  | 3 | Noun | Grinder | Prowler | Callous | Squirmer |
  | 3 | Adj | Grinding | Prowling | Hardened | Squirming |
  | 4 | Noun | Banger | Predator | Rock | Rascal |
  | 4 | Adj | Banging | Predatory | Rock-Hard | Slippery |
  | 5 | Noun | Ripper | Longshot | Boulder | Rogue |
  | 5 | Adj | Ripping | Longshot | Impenetrable | Roguish |
  | 6 | Noun | `<null>` | `<null>` | `<null>` | `<null>` |
  | 6 | Adj | `<null>` | `<null>` | `<null>` | `<null>` |
  | 7 | Noun | `<null>` | `<null>` | `<null>` | `<null>` |
  | 7 | Adj | `<null>` | `<null>` | `<null>` | `<null>` |
  | 8 | Noun | `<null>` | `<null>` | `<null>` | `<null>` |
  | 8 | Adj | `<null>` | `<null>` | `<null>` | `<null>` |
  | 9 | Noun | `<null>` | `<null>` | `<null>` | `<null>` |
  | 9 | Adj | `<null>` | `<null>` | `<null>` | `<null>` |
  | 10 | Noun | `<null>` | `<null>` | `<null>` | `<null>` |
  | 10 | Adj | `<null>` | `<null>` | `<null>` | `<null>` |

  Notable per-category notes from how each ladder evolved so far:
  - **Strength:** started raunchy (Goon/Fist/Pounder/Grinder/Banger) and stayed there through
    Phase 5 (Ripper) — no serious-tone pivot yet.
  - **Speed:** pivoted at Phase 4 (Predator) away from the watching/stalking bit (Blindman → Peeper
    → Lurker → Prowler) toward a more skilled-hunter identity, then Phase 5 (Longshot) leaned back
    into wordplay via the sports/gambling "shot" double meaning rather than going fully serious.
  - **Defense:** Phase 0–3 (Softie → Blister → Firmness → Callous) tell a literal "skin toughening"
    story with innuendo baked in; Phase 4–5 (Rock → Boulder) shift to material/scale escalation,
    still with double meanings (Rock-Hard, Impenetrable).
  - **Dexterity:** Phase 0–1 (Noise → Silence) flip the expected direction — starts as the opposite
    of stealthy and earns its way in, rather than starting faint and fading further. Phase 2–5
    (Creeper → Squirmer → Rascal → Rogue) stayed in a mischievous/flirty-evasion register rather
    than pivoting to the ghost/spirit imagery the category name implies — that pivot, if it happens,
    hasn't occurred yet by Phase 5.

### Not yet decided

- Words for Phases 6–10 of all 4 stat ladders (marked `<null>` above).
- Whether/where each ladder tapers from the ambiguous-humor register into more serious/evocative
  language before Phase 10, and what that transition looks like for each of the 4 themes.
