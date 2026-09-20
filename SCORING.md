# Scoring reference

Every number here is taken from [`lib/scoring.ts`](lib/scoring.ts) and
[`lib/questions.ts`](lib/questions.ts). Maximum for any question is **1000**.
Every question allows **40 seconds**.

---

## At a glance

| # | Question | Type | Max | Speed matters? |
| --- | --- | --- | --- | --- |
| 1 | Pre-drill preparations | Multi-select | 1000 | ✅ |
| 2 | 2D seismic year | Slider | 1000 | ❌ |
| 3 | Authorities for NO-0001 | Slider | 1000 | ❌ |
| 4 | Locate Al-Nokhatha | Heatmap | 1000 | ❌ |
| 5 | Rig type | Pixel reveal | 1000 | ⏱ by stage |
| 6 | JZ-0001 discovery year | Slider | 1000 | ❌ |
| 7 | Minagish wells | Multi-select | 1000 | ✅ |
| 8 | Oil discovery wells | Multi-select | 1000 | ✅ |
| 9 | SLB offshore study year | Slider | 1000 | ❌ |
| 10 | More data → less risk? | Bet | wager | ❌ |

---

## The speed multiplier

Applies to **multi-select** and **range** questions. Falls linearly from
**×1.00** at the start to **×0.50** at the buzzer.

| Answered at | Multiplier |
| --- | --- |
| 0s | ×1.00 |
| 10s | ×0.88 |
| 20s | ×0.75 |
| 30s | ×0.63 |
| 40s | ×0.50 |

Sliders and the heatmap are **not** speed-weighted — they reward accuracy
alone, so nobody is punished for thinking carefully about a number.

---

## Multi-select — questions 1, 7, 8

```
(correct picked − wrong picked) ÷ (total correct) × 1000 × speed
```

Answered at 5 seconds, with 2 correct options out of 4:

| Picked | Score |
| --- | --- |
| Both right | **938** |
| One right only | 469 |
| One right + one wrong | **0** |
| All four | **0** |
| Both wrong | 0 |

> ⚠️ **Selecting everything scores zero.** Wrong picks are subtracted from
> right ones. Without that, the whole room would just tick every box.

---

## Sliders — questions 2, 3, 6, 9

```
1000 × (1 − distance ÷ furthest possible miss)
```

"Furthest possible miss" is measured from the answer to whichever end of the
range is further away — so a guess at either extreme is treated fairly.

**Q2 — 2D seismic year · range 2000–2025 · answer 2014**

| Guess | Score |
| --- | --- |
| 2014 | **1000** |
| 2013 | 929 |
| 2012 | 857 |
| 2010 | 714 |
| 2005 | 357 |
| 2000 | 0 |

**Q3 — authorities · range 0–70 · answer 12**

| Guess | Score |
| --- | --- |
| 12 | **1000** |
| 10 | 966 |
| 15 | 948 |
| 20 | 862 |
| 35 | 603 |
| 50 | 345 |
| 70 | 0 |

> Note: the range was set to 0–70 when the answer was 30. With the answer
> now 12, everything interesting happens in the left fifth of the slider and
> the untouched default (35) still scores 603. Tightening to 0–40 would make
> it considerably more discriminating.

**Q9 — SLB offshore study · range 2000–2026 · answer 2018**

| Guess | Score |
| --- | --- |
| 2018 | **1000** |
| 2017 | 944 |
| 2016 | 889 |
| 2013 | 722 |
| 2010 | 556 |
| 2026 | 556 |
| 2000 | 0 |

**Q6 — JZ-0001 year · range 2010–2026 · answer 2025**

| Guess | Score |
| --- | --- |
| 2025 | **1000** |
| 2024 | 933 |
| 2026 | 933 |
| 2022 | 800 |
| 2018 | 533 |
| 2010 | 0 |

> Note: 2025 sits one step from the top of the range, so dragging the slider
> fully right scores 933. That is unavoidable — a discovery cannot be in the
> future — but it makes Q6 the easiest of the three sliders.

---

## Heatmap — question 4

```
1000 × (1 − distance ÷ 0.5)
```

Distance is measured across the map as a fraction of its width, so 0.1 is a
tenth of the way across. Tolerance is **0.5**, deliberately forgiving: the
room is tapping open water with no label to aim at.

| Distance from the field | Score |
| --- | --- |
| Dead on | **1000** |
| 0.05 | 900 |
| 0.10 | 800 |
| 0.20 | 600 |
| 0.35 | 300 |
| 0.50 or more | 0 |

In practice: the right patch of sea scores well, the desert scores nothing.

---

## Pixel reveal — question 5

Fixed points by the stage showing when they answer. The image sharpens every
**10 seconds** across the 40-second window.

| Answer at | Points |
| --- | --- |
| Stage 1 (from 0s) | **1000** |
| Stage 2 (from 10s) | 700 |
| Stage 3 (from 20s) | 400 |
| Stage 4 (from 30s) | 100 |

> ⚠️ **A wrong answer scores 0 and locks that player out** for the rest of the
> question. That is what makes answering early a genuine gamble rather than a
> free guess.

---

## Range band — no longer in the deck

Question 9 used to be a range band ("pick a low and a high"). It is now a
slider, so no question currently uses this type — but the mechanic is still
built and documented in [`lib/questions.ts`](lib/questions.ts) if you want it
back. It scores on overlap (intersection over union), which means covering the
whole slider to play safe scores badly.

---

## The finale — question 10

Two beats. A **30-second wager window** first, with the question hidden, then
the question itself on a 40-second clock.

The wager is any amount from 0 up to that player's entire score.

| Outcome | Result |
| --- | --- |
| Answered **NO** (correct) | **+ the full wager** (doubles it) |
| Answered **YES** | **− the full wager** |
| Wagered 0 | score unchanged, whatever they answer |
| Wagered, then never answered | **− the full wager** |

No partial credit — it is right or wrong. Nobody can fall below **0**.

> ⚠️ **This is a coin flip.** Someone guessing blind has a 50% chance of
> doubling. The leaderboard can completely invert on this question — which is
> the point of "double or lose", but worth knowing before you run it.

---

## Changing any of this

- **Per-question values** (ranges, answers, tolerance, stage points, time
  limits) live in [`lib/questions.ts`](lib/questions.ts)
- **The formulas** live in [`lib/scoring.ts`](lib/scoring.ts) — pure functions,
  each with the reasoning in a comment
- `MAX_POINTS` (1000) and `MIN_CORRECT_POINTS` (500) are the two constants at
  the top of that file
