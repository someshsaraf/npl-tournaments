import type { Store } from './store.js';
import {
  PREDICTIONS_TOP,
  predictionTallies,
  predictionTalliesPath,
  predictionsPath,
  type PredictionSport
} from '../src/data/predictions.js';

/**
 * Keep predictionTallies/{sport} (counts only — community-readable) in step
 * with predictions/{sport} (villa → pick — admins only), so the vote meters
 * move the moment someone votes or an admin deletes a vote.
 */
export function keepPredictionTallies(store: Store): void {
  const sports: PredictionSport[] = ['badminton', 'tennis'];
  const refresh = (sport: PredictionSport) => {
    const next = predictionTallies(store.get(predictionsPath(sport)));
    const path = predictionTalliesPath(sport);
    if (JSON.stringify(store.get(path) ?? {}) !== JSON.stringify(next)) store.set(path, next);
  };
  sports.forEach(refresh);
  store.onChange((paths) => {
    for (const sport of sports) {
      const own = predictionsPath(sport);
      if (paths.some((p) => p === '' || p === PREDICTIONS_TOP || p === own || p.startsWith(`${own}/`))) refresh(sport);
    }
  });
}
