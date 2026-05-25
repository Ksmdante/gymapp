# Daily Workout Prompt Pack

Paste the block below into a Claude chat at the start of every workout-planning conversation. Then just tell Claude what you want ("a heavy push day focused on bench", "a light pull deload", etc.) and it'll spit out a valid JSON blob you can copy straight into cell **A2** of the `workouts` tab.

---

## Paste this into Claude:

````
You're helping me build a single workout for my gym tracker app. Output a JSON object matching the schema below — no markdown, no commentary, just the raw JSON inside one fenced ```json``` block so I can copy it cleanly.

## Schema

```ts
{
  id: 'push' | 'pull' | 'legs',          // which session card it replaces in the app
  name: string,                          // shown on home card, e.g. "Push (Heavy)"
  subtitle: string,                      // muscle groups, e.g. "Chest, Shoulders, Triceps"
  day: string,                           // shown on card, e.g. "Today" or "Tuesday"
  warmup: string,                        // one paragraph of warmup instructions
  exercises: [
    {
      id: string,                        // stable ID — reuse existing IDs (see list below) so weight progression carries over
      name: string,                      // display name
      equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight',
      compound: boolean,                 // true for primary lifts (bench, squat, row, etc.)
      sets: number,                      // working set count, usually 2–4
      repsMin: number,                   // bottom of rep range
      repsMax: number,                   // top of rep range — hitting this on all sets triggers progression
      startWeight: number,               // fallback weight in kg if app has no history
      progressionKg: number,             // weight bump after a successful session (usually 2.5 for compounds, 1–2 for isolation)
      rest: number,                      // rest in seconds between sets (60 for isolation, 90 mid, 150 heavy compound)
      cue: string,                       // one-sentence coaching cue
      note: string                       // setup detail, e.g. "Flat bench, medium grip"
    }
  ],
  finisher: null | {                     // optional add-on block, app lets me pick exercises after main work
    name: string,
    subtitle: string,
    exercises: [ /* same shape as above */ ]
  }
}
```

## Reuse these existing exercise IDs when possible

Reusing IDs means weights and progression history carry over between sessions. Only invent a new ID for a genuinely new exercise.

**Push:** bench_press, incline_db_press, db_ohp, cable_lat_raise, cable_pushdown, overhead_tricep_ext, db_lat_raise, db_front_raise, cable_upright_row
**Pull:** landmine_row, lat_pulldown, seated_cable_row, face_pulls, incline_db_curl, hammer_curl, ez_bar_curl, cable_conc_curl, db_skullcrusher
**Legs:** back_squat, glute_bridge, leg_press, seated_leg_curl, lying_leg_curl, leg_extension, calf_raise

When creating new IDs: snake_case, descriptive, equipment hint if useful (e.g. `db_pullover`, `cable_crossover`, `smith_squat`).

## Rules

- 4–7 main exercises per session
- Heavy compound first (4 sets, 6–8 reps, 150s rest)
- Then 2–3 secondary lifts (3 sets, 8–12 reps, 90s rest)
- Then 1–2 isolation/accessory (2–3 sets, 12–15+ reps, 60s rest)
- `progressionKg`: 2.5 for barbell compounds, 2 for dumbbells, 1 for lateral raises, 5 for machines
- Output ONE fenced ```json``` block, no other text

## What I want today:

[describe the session here, e.g. "Push day, normal intensity, prioritise shoulders, no finisher"]
````

---

## How to use the output

1. Claude returns a JSON block
2. Copy everything between the ```json and ``` markers (not the fences themselves)
3. Open your Google Sheet → `workouts` tab → click cell **A2**
4. Paste, hit Enter
5. Open the app — the matching session card (push/pull/legs) gets the blue "Today" badge and loads your custom session

If the JSON is malformed, the app silently falls back to the hardcoded workout — open the browser DevTools Console to see the parse error.

## Tip

If you want to plan a whole week, ask for one JSON per day in the same chat, then paste each into A2 the morning you train it. A2 only stores one session at a time — overwriting is fine, the history of past sessions is already in the `history` tab.
