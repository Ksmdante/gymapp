/**
 * GymApp — Google Sheets backend
 *
 * Deploy as a Web App (Extensions → Apps Script in your Sheet):
 *   1. Paste this into Code.gs
 *   2. Set SHEET_ID below to your sheet's ID (the long string in its URL)
 *   3. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Copy the Web App URL into js/sheets.js (SHEETS_URL constant)
 *
 * CORS notes:
 *   - GET requests work cross-origin automatically.
 *   - POST requests must use Content-Type: text/plain to avoid a CORS
 *     preflight (Apps Script Web Apps cannot answer OPTIONS requests).
 *     js/sheets.js already does this.
 */

const SHEET_ID = '1j3dVVu8zkmvksu1Ro6g05gN_5sxlMcfgPSsfwVHVXUs';

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getWorkout') return json(getWorkout());
    if (action === 'getWeights') return json(getWeights());
    if (action === 'getHistory') return json(getHistory());
    return json({ error: 'unknown action: ' + action });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'saveSession') return json(saveSession(body.data));
    if (body.action === 'saveWeight') return json(saveWeight(body.exerciseId, body.weight));
    if (body.action === 'saveWorkout') return json(saveWorkout(body.data));
    if (body.action === 'clearAll') return json(clearAll());
    return json({ error: 'unknown action: ' + body.action });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getWorkout() {
  const sheet = ss().getSheetByName('workouts');
  if (!sheet) return null;
  const raw = sheet.getRange('A2').getValue();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { error: 'workout JSON in A2 is invalid: ' + err };
  }
}

function getHistory() {
  const sheet = ss().getSheetByName('history');
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const rows = sheet.getRange(2, 1, last - 1, 7).getValues();
  return rows.map((r) => {
    let exercises = [];
    try { exercises = JSON.parse(r[6]); } catch (e) { exercises = []; }
    return {
      id: String(r[0]),
      sessionType: String(r[1]),
      date: r[2] instanceof Date ? r[2].toISOString() : String(r[2]),
      duration: String(r[3]),
      totalSets: Number(r[4]) || 0,
      totalVolume: Number(r[5]) || 0,
      exercises: exercises
    };
  });
}

function getWeights() {
  const sheet = ss().getSheetByName('weights');
  if (!sheet) return {};
  const last = sheet.getLastRow();
  if (last < 2) return {};
  const rows = sheet.getRange(2, 1, last - 1, 2).getValues();
  const out = {};
  for (const [id, w] of rows) {
    if (id) out[String(id)] = Number(w);
  }
  return out;
}

function saveSession(data) {
  const sheet = ss().getSheetByName('history');
  if (!sheet) throw new Error('no `history` tab');
  const totalSets = data.exercises.reduce(
    (a, e) => a + (e.sets ? e.sets.length : 0), 0);
  const totalVolume = data.exercises.reduce((a, e) =>
    a + (e.sets || []).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0), 0);
  sheet.appendRow([
    data.id,
    data.sessionType,
    data.date,
    data.duration,
    totalSets,
    totalVolume,
    JSON.stringify(data.exercises)
  ]);
  return { ok: true };
}

function saveWorkout(data) {
  const sheet = ss().getSheetByName('workouts');
  if (!sheet) throw new Error('no `workouts` tab');
  sheet.getRange('A2').setValue(data);
  return { ok: true };
}

function clearAll() {
  const book = ss();
  for (const tabName of ['history', 'weights']) {
    const sheet = book.getSheetByName(tabName);
    if (!sheet) continue;
    const last = sheet.getLastRow();
    if (last >= 2) {
      sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
    }
  }
  return { ok: true, cleared: ['history', 'weights'] };
}

function saveWeight(exerciseId, weight) {
  const sheet = ss().getSheetByName('weights');
  if (!sheet) throw new Error('no `weights` tab');
  const now = new Date().toISOString();
  const last = sheet.getLastRow();
  if (last >= 2) {
    const ids = sheet.getRange(2, 1, last - 1, 1).getValues().flat().map(String);
    const idx = ids.indexOf(String(exerciseId));
    if (idx >= 0) {
      sheet.getRange(idx + 2, 2).setValue(weight);
      sheet.getRange(idx + 2, 3).setValue(now);
      return { ok: true, updated: true };
    }
  }
  sheet.appendRow([exerciseId, weight, now]);
  return { ok: true, inserted: true };
}
