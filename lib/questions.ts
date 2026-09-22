/**
 * ============================================================================
 *  THE QUESTION DECK — this is the file you edit.
 * ============================================================================
 *
 * Swap in your real questions here. Nothing else needs to change: the store,
 * the projector and the phones all read from this array.
 *
 * Rules of thumb
 *  - `id` must be unique and stable (it keys the answer map).
 *  - Order in the array = order in the game.
 *  - `timeLimit` is in seconds.
 *  - Put the `bet` question last — it is the finale and uses every player's
 *    accumulated score as the wager ceiling.
 *
 * ---------------------------------------------------------------------------
 * QUICK REFERENCE — the six question types
 * ---------------------------------------------------------------------------
 *
 * 1) Multiple choice
 *    { id, type: "mcq", prompt, options: [4 strings], correctIndex, timeLimit }
 *    Scores 1000 × speed multiplier (never below 500 if correct).
 *
 * 2) Multiple response — "select all that apply", more than one correct
 *    { id, type: "multi", prompt, options, correctIndexes: [0, 1], timeLimit }
 *    Partial credit: (correct picked − wrong picked) / (total correct) × 1000,
 *    then × speed multiplier. Selecting everything scores ZERO.
 *
 * 3) Slider guess — projector draws a live histogram
 *    { id, type: "slider", prompt, min, max, step, unit, answer, timeLimit }
 *    Scores by closeness: 1000 × (1 − normalised distance).
 *    `thousands: true` renders 500000 as "500,000".
 *
 * 4) Heatmap tap — players tap once on an image
 *    { id, type: "heatmap", prompt, image, answer: {x, y}, tolerance, timeLimit }
 *    x/y are NORMALISED 0..1 (0,0 = top-left of the image).
 *    Scores by 2D distance, zero beyond `tolerance`.
 *
 * 5) Pixel reveal — image sharpens in steps, phones show options
 *    { id, type: "pixel", prompt, image, options, correctIndex,
 *      stagePoints: [1000, 700, 400, 100], stageDuration: 7, timeLimit }
 *    Answer early for more points. A WRONG answer locks the player out.
 *
 * 6) Range band — players pick a LOW and a HIGH, not a single value
 *    { id, type: "range", prompt, min, max, step, unit,
 *      answerMin, answerMax, timeLimit }
 *    Scored on overlap (intersection over union), so covering the whole
 *    slider to play it safe scores almost nothing.
 *
 * 7) Final bet — wager first, then the question. Two flavours:
 *
 *    mode: "choice"  — right or wrong, win or lose the whole wager
 *      { id, type: "bet", mode: "choice", prompt, options, correctIndex,
 *        betTimeLimit, timeLimit, intro? }
 *
 *    mode: "numeric" — answered on a slider; the closest HALF of the room wins
 *      { id, type: "bet", mode: "numeric", prompt, min, max, step, unit,
 *        answer, betTimeLimit, timeLimit, intro? }
 *
 *    `intro` is the slide shown while wagers are open:
 *      { headline, subline, safeLabel, riskLabel }
 *
 * ---------------------------------------------------------------------------
 * ARTWORK
 * ---------------------------------------------------------------------------
 * `image` refers to a built-in SVG in components/art/. Two ship with the demo:
 *   "contour" — an offshore block contour map (for heatmap questions)
 *   "jackup"  — a jack-up rig drawing (for pixel-reveal questions)
 * To add your own, drop a component in components/art/ and register it in
 * components/art/index.tsx.
 */

import type { Question } from "./types";

export const QUESTIONS: Question[] = [
  // --- 1. Multi-select: pre-drill preparations ------------------------------
  {
    id: "q1",
    type: "multi",
    prompt:
      "Select two or more surveys required for geohazard assessment before drilling an exploratory offshore well",
    // Both decoys are genuine pre-drill activities, which is what makes them
    // tempting: neither is a geohazard SURVEY. Deliberately avoided naming a
    // specific geophysical method (gravity, magnetics) as a decoy, since those
    // are themselves geophysical surveys and would make option D ambiguous.
    // Interleaved so the correct pair cannot be spotted by position.
    options: [
      "Rig acceptance audit",
      "Geotechnical survey",
      "Reservoir simulation study",
      "Geophysical survey",
    ],
    correctIndexes: [1, 3],
    timeLimit: 30,
  },

  // --- 2. Slider: year the 2D seismic was acquired --------------------------
  {
    id: "q2",
    type: "slider",
    prompt: "In what year was the Kuwait offshore 2D seismic survey acquired?",
    min: 2000,
    max: 2025,
    step: 1,
    unit: "",
    answer: 2014,
    timeLimit: 30,
    // Years are not quantities — without this the axis would read "2.0k".
    thousands: false,
  },

  // --- 3. Slider: how many authorities signed off ---------------------------
  {
    id: "q3",
    type: "slider",
    prompt:
      "How many separate authorities were involved in securing approvals and permits before drilling NO-0001?",
    min: 0,
    max: 40,
    step: 1,
    unit: "",
    // Plain counts, never compacted to "12k".
    thousands: false,
    answer: 12,
    timeLimit: 30,
  },

  // --- 4. Heatmap: locate the Al-Nokhatha field -----------------------------
  // `image` is the CLEAN map — no field marker, because that IS the answer.
  // `revealImage` is the same map with Al-Nokhatha drawn in, cross-faded once
  // the answer is out.
  // public/maps/kuwait.jpg       the original KOC map (field marked)
  // public/maps/kuwait-clean.jpg  generated by `npm run clean-map`
  {
    id: "q4",
    type: "heatmap",
    prompt: "Locate Al-Nokhatha offshore field on the map",
    image: "/maps/kuwait-clean.jpg",
    revealImage: "/maps/kuwait.jpg",
    // Both measured from the image itself by scripts/clean_map.py — rerun
    // `npm run clean-map` after swapping the map and paste what it prints.
    aspect: 1.4147,
    answer: { x: 0.7696, y: 0.4857 },
    // Forgiving: the room is tapping open water with no label to aim at, so
    // the right general patch of sea still scores well. LOWER it (toward 0.2)
    // to demand precision — smaller tolerance = tighter scoring.
    tolerance: 0.5,
    timeLimit: 30,
  },

  // --- 5. Pixel reveal: identify the rig ------------------------------------
  {
    id: "q5",
    type: "pixel",
    prompt: "What type of rig is this?",
    image: "jackup",
    options: ["Jack-up", "Semi-submersible", "Drillship", "Spar platform"],
    correctIndex: 0,
    stagePoints: [1000, 700, 400, 100],
    stageDuration: 7,
    timeLimit: 30,
  },

  // --- 6. Slider: when JZ-0001 was discovered -------------------------------------
  {
    id: "q6",
    type: "slider",
    prompt: "In what year was JZ-0001 discovered?",
    min: 2010,
    max: 2026,
    step: 1,
    unit: "",
    answer: 2025,
    timeLimit: 30,
    // Years render in full, never compacted to "2.0k".
    thousands: false,
  },

  // --- 7. Multi-select: which wells found the Minagish ----------------------
  {
    id: "q7",
    type: "multi",
    prompt: "In which of these wells was the Minagish discovered?",
    // Interleaved so the correct pair is not adjacent and cannot be spotted
    // by position alone.
    options: ["NO-0001", "JL-0002", "HA-0001", "JZ-0001"],
    correctIndexes: [0, 3],
    timeLimit: 30,
  },

  // --- 8. Multi-select: which wells found oil -------------------------------
  {
    id: "q8",
    type: "multi",
    prompt: "In which of these wells was oil discovered?",
    // Shuffled to a DIFFERENT order than q7, which uses the same four wells:
    // otherwise players answer from remembered positions rather than knowledge.
    options: ["HA-0001", "NO-0001", "JZ-0001", "JL-0002"],
    correctIndexes: [1, 3],
    timeLimit: 30,
  },

  // --- 9. MCQ: spot the well that is not offshore ---------------------------
  {
    id: "q9",
    type: "mcq",
    prompt: "Which of the following is not an offshore well?",
    options: ["HA-0001", "RI-0001", "HU-0001", "ZU-0001"],
    correctIndex: 2,
    timeLimit: 30,
  },

  // --- 10. Finale: double or lose -------------------------------------------
  // `mode: "choice"` makes this a straight right-or-wrong wager: win the bet
  // and you double it, miss and it is gone. `intro` is the dramatic slide the
  // projector shows while wagers are open, before the question is revealed.
  {
    id: "q10",
    type: "bet",
    mode: "choice",
    intro: {
      headline: "DOUBLE OR LOSE",
      subline: "You have reached a decision point.",
      safeLabel: "KEEP YOUR POINTS",
      riskLabel: "BET EVERYTHING",
    },
    prompt: "Does acquiring more data always reduce exploration risk?",
    options: ["YES", "NO"],
    correctIndex: 1,
    betTimeLimit: 30,
    timeLimit: 30,
  },

];

/** Total depth for the projector's progress bar, in metres. */
export const TOTAL_DEPTH_M = 3000;

/** Convenience lookups used across the server. */
export const questionById = (id: string): Question | undefined =>
  QUESTIONS.find((q) => q.id === id);

export const questionAt = (index: number): Question | undefined =>
  index >= 0 && index < QUESTIONS.length ? QUESTIONS[index] : undefined;
