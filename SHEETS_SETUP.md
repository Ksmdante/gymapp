# Google Sheets Backend Setup

This is **optional**. The app works fully offline with hardcoded workouts and localStorage. The Sheet just adds:

- A way to push a custom workout to the app each day (the "Today" badge on the home screen)
- A cloud copy of every session you complete
- A shared current-weights record across devices

If `js/sheets.js` has an empty `SHEETS_URL` (the default), the app skips all of this silently.

---

## 1. Create the Google Sheet

Make a new spreadsheet at [sheets.new](https://sheets.new) and create **three tabs** with these exact lowercase names:

### Tab: `workouts`

One cell of interest. You paste a workout JSON blob into A2 before each session.

| | A |
|---|---|
| 1 | data |
| 2 | `{"id":"push","name":"Push","subtitle":"Chest, Shoulders, Triceps","day":"Tuesday","warmup":"...","exercises":[...],"finisher":null}` |

The JSON in A2 must match the same shape as the entries in `js/workouts.js` (id, name, subtitle, day, warmup, exercises[], optional finisher). The `id` should be `push`, `pull`, or `legs` — the app replaces the matching local session with it.

If A2 is empty, the app just uses the hardcoded workout for that day.

### Tab: `history`

Headers in row 1. The app appends one row per completed session.

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| id | sessionType | date | duration | totalSets | totalVolume | exercisesJSON |

### Tab: `weights`

Headers in row 1. The app upserts one row per exercise as you progress.

| A | B | C |
|---|---|---|
| exerciseId | weight | updatedAt |

You can pre-populate this with your starting weights if you like — the app will read them on startup and override its local cache.

---

## 2. Deploy the Apps Script

1. In the Sheet, go to **Extensions → Apps Script**
2. Delete the default `Code.gs` contents and paste in the contents of `Code.gs` from this repo
3. At the top, replace `PASTE_YOUR_SHEET_ID_HERE` with your Sheet's ID. The ID is the long string between `/d/` and `/edit` in the Sheet's URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
   ```
4. Save (disk icon)
5. Click **Deploy → New deployment**
   - Click the gear icon → **Web app**
   - Description: anything
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**. Authorise when prompted (it'll warn about unverified app — click Advanced → Go to project).
7. Copy the **Web app URL**. It looks like:
   ```
   https://script.google.com/macros/s/AKfyc.../exec
   ```

---

## 3. Wire up the client

Open `js/sheets.js` and paste your Web App URL into the `SHEETS_URL` constant:

```js
const SHEETS_URL = 'https://script.google.com/macros/s/AKfyc.../exec';
```

Commit and push. Done.

---

## How the daily flow works

1. The night before / morning of, open the Sheet and paste your workout JSON for the day into `workouts!A2`
2. Open the app — it fetches `A2`, replaces the matching session card, and tags it with a blue "Today" badge
3. Train as normal
4. When you tap **Done** on the complete screen, the app saves the session to the `history` tab and updates any progressed weights in the `weights` tab — all in the background, no waiting

If the Sheet is unreachable (no signal, deploy URL wrong, whatever), the app falls back to the hardcoded workouts in `js/workouts.js` and saves nothing remotely. Everything still works.

---

## Re-deploying after Code.gs changes

If you change `Code.gs`, you must **Deploy → Manage deployments → pencil icon → Version: New version → Deploy** to update the live URL. Editing the code alone doesn't update what's served.
