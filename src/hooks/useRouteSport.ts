import { useParams, useSearchParams } from 'react-router-dom';
import type { Sport } from '../data/tournamentData';
import { sportFromParam } from '../data/sports';

/**
 * Sport for sport-scoped screens (/score/:sport, /live/:sport, /scorer/:sport,
 * /admin/score?sport=…). Accepts the URL slug (lawn-tennis) or the id
 * (tennis); anything else — including no param — is badminton, which keeps
 * every pre-existing URL working unchanged.
 */
export function useRouteSport(): Sport {
  const params = useParams<{ sport?: string }>();
  const [searchParams] = useSearchParams();
  return sportFromParam(params.sport) ?? sportFromParam(searchParams.get('sport')) ?? 'badminton';
}
