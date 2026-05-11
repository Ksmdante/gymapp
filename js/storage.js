const HISTORY_KEY = 'cr_history';
const WEIGHTS_KEY = 'cr_weights';

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function getHistory() {
  return read(HISTORY_KEY) || [];
}

export function saveSession(session) {
  const history = getHistory();
  history.push(session);
  write(HISTORY_KEY, history);

  const weights = getAllWeights();
  for (const ex of session.exercises) {
    if (!ex.skipped && ex.allHitMax) {
      weights[ex.id] = (weights[ex.id] || ex.weight) + ex.progressionKg;
    } else if (!weights[ex.id]) {
      weights[ex.id] = ex.weight;
    }
  }
  write(WEIGHTS_KEY, weights);
}

export function getSessionsForType(type) {
  return getHistory().filter((s) => s.sessionType === type);
}

export function getWeight(exerciseId, fallback) {
  const weights = getAllWeights();
  return weights[exerciseId] ?? fallback;
}

export function setWeight(exerciseId, weight) {
  const weights = getAllWeights();
  weights[exerciseId] = weight;
  write(WEIGHTS_KEY, weights);
}

export function getAllWeights() {
  return read(WEIGHTS_KEY) || {};
}

export function getExerciseHistory(exerciseId) {
  const history = getHistory();
  const results = [];
  for (const session of history) {
    for (const ex of session.exercises) {
      if (ex.id === exerciseId) {
        results.push({ date: session.date, weight: ex.weight, sets: ex.sets });
      }
    }
  }
  return results;
}

export function getTotalSessions() {
  return getHistory().length;
}

export function clearAll() {
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(WEIGHTS_KEY);
}
