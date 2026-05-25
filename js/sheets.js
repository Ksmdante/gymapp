// Google Sheets backend client. All calls fail silently — the app
// must work fully offline if SHEETS_URL is empty or the network is down.
//
// Paste your deployed Apps Script Web App URL here:
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzGI3BXswjEE7CoPrz4_SMKez6SlEoxUQSXb8XmJaNgypSaFdAj-hfHMjN-63xUsCJQ/exec';

const TIMEOUT_MS = 6000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function get(action) {
  if (!SHEETS_URL) return null;
  try {
    const res = await withTimeout(
      fetch(`${SHEETS_URL}?action=${encodeURIComponent(action)}`),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.error) {
      console.warn('[sheets]', action, data.error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[sheets]', action, 'failed:', err.message);
    return null;
  }
}

async function post(body) {
  if (!SHEETS_URL) return false;
  try {
    // text/plain avoids a CORS preflight — Apps Script Web Apps can't
    // respond to OPTIONS, so application/json would be blocked.
    const res = await withTimeout(
      fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      }),
      TIMEOUT_MS
    );
    return res.ok;
  } catch (err) {
    console.warn('[sheets]', body && body.action, 'failed:', err.message);
    return false;
  }
}

export async function fetchTodaysWorkout() {
  return await get('getWorkout');
}

export async function fetchWeights() {
  return await get('getWeights');
}

export async function fetchHistory() {
  return await get('getHistory');
}

export async function saveSession(data) {
  return await post({ action: 'saveSession', data });
}

export async function saveWeight(exerciseId, weight) {
  return await post({ action: 'saveWeight', exerciseId, weight });
}

export async function clearAll() {
  return await post({ action: 'clearAll' });
}

export function isConfigured() {
  return !!SHEETS_URL;
}
