# Offshore — Workshop Quiz

A real-time quiz for the offshore exploration workshop. Players join from their
phones, questions play out on a projector, and you drive the whole thing from a
control panel on your laptop.

---

## Running it

**The easy way:** double-click **`START QUIZ.command`** in this folder. It
installs anything missing, starts the server, and opens both views for you.

> ⚠️ **Leave the Terminal window it opens running.** That window *is* the quiz.
> Closing it stops everything.

**From a terminal instead:**

```bash
npm install
npm run dev
```

Then open:

| View | URL | Where it goes |
| --- | --- | --- |
| **Projector** | http://localhost:3000/screen | The big screen |
| **Control panel** | http://localhost:3000/admin | Your laptop or phone |
| **Player** | http://localhost:3000/play | What the audience sees |

No environment variables, no accounts, no external services.

---

## Getting phones connected

The projector shows a QR code and a short URL. Both point at your machine's
**network address**, not `localhost`, so phones can reach it.

**Everyone must be on the same Wi-Fi as the laptop.**

> ⚠️ **Public and guest Wi-Fi usually will not work.** Most have *client
> isolation*, which lets devices reach the internet but blocks them from
> reaching each other. Phones will scan the code and time out.
>
> If the URL on screen starts `172.20.10.` you are on an iPhone hotspot —
> fine for a handful of testers, but it caps out around 5–10 devices.
>
> For a real room, ask IT for a network without client isolation, or deploy
> the app (see *Going online* below).

---

## The 60-second demo script

Open `/screen` on the projector and `/admin` on your laptop. Click **🔊 Enable
sound** on the projector first if you want the countdown ticks.

| # | You do | They see | Say something like |
| --- | --- | --- | --- |
| 1 | **🤖 Simulate 50 players** | Names flooding the lobby, counter climbing to "50 aboard" | *"Everyone scans the QR and they're in — no app, no login."* |
| 2 | **▶ Start question 1** | Four options, countdown ring, live "answered 34/50" | *"Forty seconds. Pick every answer you think is right."* |
| 3 | **✨ Reveal answer** | Correct options glow green, vote counts per option | *"And we can see how the room split."* |
| 4 | **📊 Show leaderboard** → **▶ Start question 2** | Top 10, then the year slider | *"Now a guess — watch the histogram build live."* |
| 5 | Let it run, then **✨ Reveal** | Bars growing, then the answer line drops at 2014 | *"That's the room's intuition, live. The line is the truth."* |
| 6 | Jump to **question 4** | Radar sweep, heat building, zoom into Al-Nokhatha on reveal | *"Tap the map. Scored by how close you were."* |
| 7 | Jump to **question 5** | Rig sharpening in 4 steps, points ticking 1000 → 700 → 400 → 100 | *"Answer early for more points — a wrong guess ends your question."* |
| 8 | Jump to **question 9** | Everyone's depth bands stacking into a coverage curve | *"Pick a range. Too wide and you score almost nothing."* |
| 9 | Jump to **question 10** | **DOUBLE OR LOSE** slide, wager counter filling | *"Final round. Everyone bets their own points."* |
| 10 | **🔒 Lock bets** → **✨ Reveal** → **🏁 Final results** | Leaderboard re-sorting, then medals and confetti | *"This is where it gets loud."* |

You can jump to any question by clicking it in the control panel's list.

---

## The question deck

| # | Type | Question | Answer |
| --- | --- | --- | --- |
| 1 | Multi-select | Technical preparations before an exploratory offshore well | Geotechnical + Geophysical survey |
| 2 | Slider | Year the Kuwait offshore 2D seismic was acquired | 2014 |
| 3 | Slider | Authorities involved in permits before NO-0001 | 30 |
| 4 | Heatmap | Locate Al-Nokhatha offshore field | on the map |
| 5 | Pixel reveal | What type of rig is this? | Jack-up |
| 6 | Slider | Year JZ-0001 was discovered | 2025 |
| 7 | Multi-select | Wells where the Minagish was discovered | NO-0001 + JZ-0001 |
| 8 | Multi-select | Wells where oil was discovered | NO-0001 + JL-0002 |
| 9 | Range | Water depth range in Kuwait's offshore acreage | 0–40 m |
| 10 | Bet (choice) | Does more data always reduce exploration risk? | NO |

Every question allows **40 seconds**. The final round opens a **30-second**
wager window before the question appears.

---

## Swapping in your real questions

Everything lives in **[`lib/questions.ts`](lib/questions.ts)** — one array, with
the full schema documented at the top of the file. The seven question types:

| Type | Players do | Scoring |
| --- | --- | --- |
| `mcq` | Pick one of four | 1000 × speed, never below 500 if correct |
| `multi` | Pick every right answer | Partial credit; **selecting everything scores 0** |
| `slider` | Guess a number | By closeness, max 1000 |
| `range` | Pick a low and a high | By overlap; too wide scores badly |
| `heatmap` | Tap a spot on an image | By 2D distance |
| `pixel` | Identify a sharpening image | 1000/700/400/100 by stage; wrong = locked out |
| `bet` | Wager, then answer | Win or lose the wager |

**Changing the map (question 4):** drop a new image in `public/maps/` and run
`npm run clean-map`. It paints out the field marker so the answer isn't simply
readable, then prints the exact `aspect` and `answer` coordinates to paste back
into `questions.ts`.

---

## Edge cases that are already handled

- **Joining mid-game** — late arrivals play every remaining question
- **Duplicate names** — become "Sam 2", "Sam 3" (case-insensitive)
- **Revealing with zero answers** — shows an empty state, scores nobody
- **A phone refreshing or locking** — the player keeps their identity and score
- **Answering twice** — rejected
- **Reconnecting mid-question** — the countdown picks up in the right place
- **Clock skew** — phones show the same countdown as the projector
- **Reduced motion** — animations respect the OS accessibility setting

Phones never receive the correct answer until the reveal. It is stripped
server-side in [`lib/store/projections.ts`](lib/store/projections.ts), so it
cannot be read out of devtools.

---

## Going online

The app currently keeps the whole game **in the server's memory**. That is
perfect for one laptop in one room, and it is why no setup is needed.

**It will not work on Vercel as-is.** Vercel runs code across many short-lived
instances, so players would land on different copies of the game and see
different states. The live connection also gets cut short there.

To deploy for real, the storage layer has to move to something shared —
Supabase is the intended target. The code is already built for this:

- Every state change goes through one interface,
  [`lib/store/types.ts`](lib/store/types.ts)
- The in-memory implementation is isolated in
  [`lib/store/memory.ts`](lib/store/memory.ts)
- Swapping it is a change to **one file**:
  [`lib/store/index.ts`](lib/store/index.ts)
- The client hook [`lib/client/useGameStream.ts`](lib/client/useGameStream.ts)
  is the matching seam on the browser side
- The scoring rules in [`lib/scoring.ts`](lib/scoring.ts) are pure functions
  and port unchanged

---

## Project layout

```
app/
  screen/      the projector view
  play/        the player's phone
  admin/       the control panel
  api/
    stream/    Server-Sent Events — the real-time channel
    join/      player sign-up
    answer/    answer + wager submission
    admin/     every control-panel action
    qr/        QR code generation
    info/      finds the LAN address phones should use
lib/
  questions.ts   >>> THE FILE YOU EDIT <<<
  scoring.ts     all scoring rules, pure functions
  bots.ts        simulated players
  store/         game state behind a swappable interface
  client/        React hooks, formatting, sound, confetti
components/
  screen/        projector UI
  play/          phone UI
  art/           built-in SVG artwork
public/maps/     the Kuwait concession map
scripts/
  clean_map.py   removes the field marker from a map image
```

---

## Commands

```bash
npm run dev        # start the quiz
npm run build      # production build
npm run typecheck  # type-check without building
npm run clean-map  # regenerate the clean map from public/maps/kuwait.jpg
```
