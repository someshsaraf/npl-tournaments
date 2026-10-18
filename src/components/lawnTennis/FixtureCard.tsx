import type { MatchState } from '../../data/tournamentData';
import { categoryLabel, type TournamentFixture } from '../../data/tennisTournament';
import {
  fixtureStageLabel,
  fixtureStatus,
  resolveSide,
  resultFor,
  winnerSideOf,
  type TournamentContext
} from '../../utils/tennisTournament';
import { formatTennisPointLabel } from '../../utils/tennisScoring';

/**
 * One fixture row: time/court, category + stage, both sides, and either the
 * final score (winner highlighted), the live score, or "vs".
 */
export function FixtureCard({
  ctx,
  fixture,
  live,
  showCategory = true,
  compact = false
}: {
  ctx: TournamentContext;
  fixture: TournamentFixture;
  live: MatchState | null;
  showCategory?: boolean;
  compact?: boolean;
}) {
  const a = resolveSide(ctx, fixture.sideA);
  const b = resolveSide(ctx, fixture.sideB);
  const status = fixtureStatus(ctx, fixture, live);
  const result = resultFor(ctx, fixture.id);
  const category = ctx.tournament.categories.find((c) => c.id === fixture.categoryId);

  let gamesA: string | number = '';
  let gamesB: string | number = '';
  let winner: 1 | 2 | null = null;
  if (status === 'completed' && result) {
    winner = winnerSideOf(result, a.label, b.label);
    const aIsP1 = result.player1.trim().toLowerCase() !== b.label.trim().toLowerCase();
    gamesA = aIsP1 ? result.score1 : result.score2;
    gamesB = aIsP1 ? result.score2 : result.score1;
  } else if (status === 'live' && live?.tennis) {
    const t = live.tennis;
    const aIsP1 = (live.player1 || '').trim().toLowerCase() !== b.label.trim().toLowerCase();
    const [ga, gb, pa, pb] = aIsP1
      ? [t.gamesWon1, t.gamesWon2, t.points1, t.points2]
      : [t.gamesWon2, t.gamesWon1, t.points2, t.points1];
    gamesA = `${ga} · ${formatTennisPointLabel(pa, pb, t.isTiebreak)}`;
    gamesB = `${gb} · ${formatTennisPointLabel(pb, pa, t.isTiebreak)}`;
  }

  const sideRow = (label: string, resolved: boolean, isWinner: boolean, score: string | number) => (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`truncate text-sm ${
          isWinner ? 'font-black text-ink' : winner ? 'text-slate-400' : resolved ? 'font-semibold text-ink' : 'italic text-slate-400'
        }`}
      >
        {label}
      </span>
      {isWinner ? (
        <span className="shrink-0 rounded bg-lime-300 text-slate-900 text-[9px] font-black uppercase px-1.5 py-0.5">Won</span>
      ) : null}
      <span
        className={`ml-auto shrink-0 tabular-nums text-sm font-black ${
          status === 'live' ? 'text-rose-600' : isWinner ? 'text-ink' : 'text-slate-400'
        }`}
      >
        {score}
      </span>
    </div>
  );

  return (
    <div
      className={`rounded-xl border bg-white ${compact ? 'p-2.5' : 'p-3'} transition-colors ${
        status === 'live' ? 'border-rose-300 ring-2 ring-rose-200' : 'border-line hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        {fixture.time ? <span className="font-mono text-ink">{fixture.time}</span> : null}
        {fixture.court ? <span>Court {fixture.court}</span> : null}
        <span className="truncate">
          {showCategory && category ? `${categoryLabel(category)} · ` : ''}
          {fixtureStageLabel(ctx, fixture)}
        </span>
        {status === 'live' ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-500 text-white px-2 py-0.5">
            <span className="npl-glow-pulse size-1.5 rounded-full bg-white" aria-hidden />
            Live
          </span>
        ) : status === 'walkover' ? (
          <span className="ml-auto rounded-full bg-slate-100 text-slate-500 px-2 py-0.5">Bye</span>
        ) : null}
      </div>
      <div className="space-y-1">
        {sideRow(a.label, !!a.entry, winner === 1, gamesA)}
        {sideRow(b.label, !!b.entry, winner === 2, gamesB)}
      </div>
    </div>
  );
}
