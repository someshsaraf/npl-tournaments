import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onValue, ref, set } from '../../lib/realtime';
import { ExternalLink, Play } from 'lucide-react';
import { db, liveMatchPath, liveScoreDelayPath, youtubeLiveUrlPath } from '../../db';
import {
  BEST_OF_OPTIONS,
  INITIAL_MATCH,
  MAX_POINTS_OPTIONS,
  SPORT_LABEL,
  TENNIS_MATCH_TYPES,
  TENNIS_STAGES,
  type BestOf,
  type MatchState,
  type MaxPoints,
  type Sport,
  type TennisMatchType,
  type TennisStage
} from '../../data/tournamentData';
import {
  STAGE_LABEL,
  categoryLabel,
  matchTypeForFormat,
  tennisStageForFixture,
  type PublishedTournament,
  type TournamentFixture
} from '../../data/tournament';
import { sportSlug } from '../../data/sports';
import { buildCustomTennisMatchState } from '../../utils/tennisCustomMatch';
import { buildCustomMatchState } from '../../utils/customMatch';
import { formatTennisStageLabel } from '../../utils/tennisMatchState';
import {
  compareFixtureTime,
  fixtureStageLabel,
  fixtureStatus,
  formatFixtureDate,
  resolveSide,
  type TournamentContext
} from '../../utils/tournament';
import { delayMsToSeconds, delaySecondsToMs, parseLiveScoreDelayMs } from '../../utils/liveScoreDelay';
import { isValidYouTubeLiveUrl } from '../../utils/youtube';
import { isMatchOnCourt } from '../../hooks/useSportLiveMatch';
import { useScoreDaypartAdsAdmin } from '../../hooks/useScoreDaypartAds';
import { LiveScoreBug } from '../tournament/LiveView';
import { Btn, Chip, ConfirmBtn, FieldLabel, Notice, Panel, inputCls } from './ui';

function screensFor(sport: Sport) {
  const slug = sportSlug(sport);
  return [
    { path: `/score/${slug}`, label: 'Court scoreboard', hint: 'Big-font scores for the screen at the court.' },
    { path: `/live/${slug}`, label: 'Stream overlay', hint: 'YouTube stream + score bug (for OBS / TV).' },
    { path: `/scorer/${slug}`, label: 'Scorer (tablet)', hint: 'Tap-to-score controls for the umpire.' },
    { path: `/admin/score?sport=${sport}`, label: 'Admin score desk', hint: 'Score + save results from here.' }
  ];
}

/**
 * Match-day control for one sport: court screen links, the stream URL, the
 * match on court, and the published schedule's next matches with Start
 * buttons (which load that stage's scoring rules onto the court).
 */
export function LivePanel({
  sport,
  published,
  ctx,
  live
}: {
  sport: Sport;
  published: PublishedTournament | null;
  ctx: TournamentContext | null;
  live: MatchState | null;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const onCourt = isMatchOnCourt(live);
  const deskPath = `/admin/score?sport=${sport}`;

  const startMatch = (next: MatchState) => {
    setError(null);
    set(ref(db, liveMatchPath(sport)), next)
      .then(() => navigate(deskPath))
      .catch((err: unknown) => {
        console.error('Failed to start match:', err);
        setError('Could not start the match — check your connection.');
      });
  };

  const startFixture = (f: TournamentFixture) => {
    if (!published || !ctx) return;
    const cat = published.categories.find((c) => c.id === f.categoryId);
    const a = resolveSide(ctx, f.sideA);
    const b = resolveSide(ctx, f.sideB);
    if (!cat || !a.entry || !b.entry) {
      setError('Both sides must be known before this match can start (finish the earlier round, or set the sides on the Schedule tab).');
      return;
    }
    const stage = f.stage === 'pool' ? fixtureStageLabel(ctx, f) : STAGE_LABEL[f.stage];
    try {
      if (sport === 'tennis') {
        startMatch(
          buildCustomTennisMatchState(live ?? INITIAL_MATCH, {
            sideA: a.entry.name,
            sideB: b.entry.name,
            tennisStage: tennisStageForFixture(f.stage),
            matchType: matchTypeForFormat(cat.format),
            category: categoryLabel(cat),
            stage,
            rules: published.rules[f.stage],
            matchId: f.id
          })
        );
      } else {
        const rules = published.badmintonRules[f.stage];
        startMatch(
          buildCustomMatchState(live ?? INITIAL_MATCH, {
            sideA: a.entry.name,
            sideB: b.entry.name,
            maxPoints: rules.maxPoints,
            bestOf: rules.bestOf,
            category: categoryLabel(cat),
            stage,
            matchId: f.id
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start match.');
    }
  };

  const queue = useMemo(() => {
    if (!published || !ctx) return [];
    return published.fixtures
      .filter((f) => {
        const s = fixtureStatus(ctx, f, live);
        return s === 'upcoming' || s === 'live';
      })
      .sort(compareFixtureTime);
  }, [published, ctx, live]);

  return (
    <div className="space-y-6">
      <Panel title="Court screens" subtitle={`Open these on the court TV, the streaming PC and the umpire's tablet. They only show ${SPORT_LABEL[sport]}.`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {screensFor(sport).map((s) => (
            <a
              key={s.path}
              href={s.path}
              target="_blank"
              rel="noreferrer"
              className="group rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 hover:border-lime-400/60"
            >
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
                {s.label}
                <ExternalLink className="size-3 text-slate-500 group-hover:text-lime-300" aria-hidden />
              </p>
              <p className="text-[11px] font-mono text-lime-300/80 truncate">{s.path}</p>
              <p className="text-[11px] text-slate-500">{s.hint}</p>
            </a>
          ))}
        </div>
      </Panel>

      <StreamSettings sport={sport} />

      <Panel title="On court now">
        {live ? (
          <div className="flex flex-wrap items-center gap-4">
            <LiveScoreBug match={live} large />
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                {live.category} · {live.stage} {onCourt ? '' : '(not started / finished)'}
              </p>
              <Btn tone="primary" onClick={() => navigate(deskPath)}>
                Open score desk
              </Btn>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No {SPORT_LABEL[sport]} match loaded yet.</p>
        )}
      </Panel>

      <Panel
        title="Start a scheduled match"
        subtitle="From the published schedule. Starting loads the stage's scoring rules and links the result back to the schedule."
      >
        {!published || !ctx ? (
          <Notice tone="warn">Publish the schedule first — matches start from the published copy.</Notice>
        ) : queue.length === 0 ? (
          <p className="text-sm text-slate-500">Every scheduled match has a result.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {queue.slice(0, 40).map((f) => {
              const a = resolveSide(ctx, f.sideA);
              const b = resolveSide(ctx, f.sideB);
              const cat = published.categories.find((c) => c.id === f.categoryId);
              const isLive = live?.currentMatchId === f.id;
              const ready = !!a.entry && !!b.entry;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="w-28 shrink-0 text-xs font-mono text-slate-400">
                    {f.date ? formatFixtureDate(f.date) : 'TBD'}
                    <br />
                    {f.time || '--:--'}
                    {f.court ? ` · C${f.court}` : ''}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-lime-300/80">
                      {cat ? categoryLabel(cat) : ''} · {fixtureStageLabel(ctx, f)}
                    </p>
                    <p className={`text-sm truncate ${ready ? 'text-slate-100 font-semibold' : 'text-slate-500 italic'}`}>
                      {a.label} <span className="text-slate-500 font-normal">vs</span> {b.label}
                    </p>
                  </div>
                  {isLive ? (
                    <Btn small onClick={() => navigate(deskPath)}>
                      Resume
                    </Btn>
                  ) : onCourt ? (
                    <ConfirmBtn small tone="primary" disabled={!ready} onConfirm={() => startFixture(f)} confirmLabel="Replace match on court?">
                      <Play className="size-3" aria-hidden /> Start
                    </ConfirmBtn>
                  ) : (
                    <Btn small tone="primary" disabled={!ready} onClick={() => startFixture(f)}>
                      <Play className="size-3" aria-hidden /> Start
                    </Btn>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Panel>

      <AdHocMatch sport={sport} published={published} live={live} onStart={startMatch} />
      <CourtAdsPanel />
    </div>
  );
}

function StreamSettings({ sport }: { sport: Sport }) {
  const [url, setUrl] = useState('');
  const [delay, setDelay] = useState('0');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onValue(ref(db, youtubeLiveUrlPath(sport)), (snap) => {
      const v = snap.val();
      setUrl(typeof v === 'string' ? v : '');
    });
    const u2 = onValue(ref(db, liveScoreDelayPath(sport)), (snap) => {
      setDelay(String(delayMsToSeconds(parseLiveScoreDelayMs(snap.val()))));
    });
    return () => {
      u1();
      u2();
    };
  }, [sport]);

  const save = async () => {
    const trimmed = url.trim();
    if (trimmed && !isValidYouTubeLiveUrl(trimmed)) {
      setMsg('Enter a valid YouTube watch, live, or share URL.');
      return;
    }
    const seconds = Number(delay);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30) {
      setMsg('Delay must be between 0 and 30 seconds.');
      return;
    }
    try {
      await set(ref(db, youtubeLiveUrlPath(sport)), trimmed);
      await set(ref(db, liveScoreDelayPath(sport)), delaySecondsToMs(seconds));
      setMsg(trimmed ? `Saved — the ${SPORT_LABEL[sport]} Live tab and overlay now use this stream.` : 'Stream cleared.');
    } catch (err) {
      console.error('Failed to save stream settings:', err);
      setMsg('Save failed — check your connection.');
    }
  };

  return (
    <Panel title="YouTube Live" subtitle={`${SPORT_LABEL[sport]} has its own stream, separate from the other sports.`}>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] items-end">
        <label className="block">
          <FieldLabel>Live URL</FieldLabel>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/live/…" className={inputCls} />
        </label>
        <label className="block">
          <FieldLabel>Score delay (s)</FieldLabel>
          <input type="number" min={0} max={30} value={delay} onChange={(e) => setDelay(e.target.value)} className={inputCls} />
        </label>
        <Btn tone="primary" onClick={() => void save()}>
          Save
        </Btn>
      </div>
      <p className="text-[11px] text-slate-500">
        The delay holds the overlay score back so it matches the stream's broadcast lag.
      </p>
      {msg ? <p className="text-xs text-lime-300">{msg}</p> : null}
    </Panel>
  );
}

/** Friendly / exhibition match outside the schedule — result saves under a custom-* id. */
function AdHocMatch({
  sport,
  published,
  live,
  onStart
}: {
  sport: Sport;
  published: PublishedTournament | null;
  live: MatchState | null;
  onStart: (m: MatchState) => void;
}) {
  const [sideA, setSideA] = useState('');
  const [sideB, setSideB] = useState('');
  const [stage, setStage] = useState<TennisStage>('qualifier');
  const [matchType, setMatchType] = useState<TennisMatchType>('singles');
  const [maxPoints, setMaxPoints] = useState<MaxPoints>(21);
  const [bestOf, setBestOf] = useState<BestOf>(1);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    try {
      if (sport === 'tennis') {
        const stageKey = stage === 'qualifier' ? 'pool' : stage;
        onStart(
          buildCustomTennisMatchState(live ?? INITIAL_MATCH, {
            sideA,
            sideB,
            tennisStage: stage,
            matchType,
            category: `Friendly ${matchType === 'team' ? 'Team' : matchType === 'doubles' ? 'Doubles' : 'Singles'}`,
            stage: formatTennisStageLabel(stage),
            ...(published ? { rules: published.rules[stageKey] } : {})
          })
        );
      } else {
        onStart(
          buildCustomMatchState(live ?? INITIAL_MATCH, {
            sideA,
            sideB,
            maxPoints,
            bestOf,
            category: 'Friendly',
            stage: 'Exhibition'
          })
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start match.');
    }
  };

  return (
    <Panel title="Ad-hoc match" subtitle="Not on the schedule — e.g. an exhibition or a friendly.">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={sideA} onChange={(e) => setSideA(e.target.value)} maxLength={80} placeholder="Side A (e.g. Rahul & Priya)" className={inputCls} />
        <input value={sideB} onChange={(e) => setSideB(e.target.value)} maxLength={80} placeholder="Side B" className={inputCls} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sport === 'tennis' ? (
          <>
            {TENNIS_STAGES.map((s) => (
              <Chip key={s} active={stage === s} onClick={() => setStage(s)}>
                {formatTennisStageLabel(s)}
              </Chip>
            ))}
            <span className="w-px h-6 bg-slate-700 mx-1" aria-hidden />
            {TENNIS_MATCH_TYPES.map((m) => (
              <Chip key={m} active={matchType === m} onClick={() => setMatchType(m)}>
                <span className="capitalize">{m}</span>
              </Chip>
            ))}
          </>
        ) : (
          <>
            {MAX_POINTS_OPTIONS.map((p) => (
              <Chip key={p} active={maxPoints === p} onClick={() => setMaxPoints(p)}>
                {p} points
              </Chip>
            ))}
            <span className="w-px h-6 bg-slate-700 mx-1" aria-hidden />
            {BEST_OF_OPTIONS.map((b) => (
              <Chip key={b} active={bestOf === b} onClick={() => setBestOf(b)}>
                {b === 3 ? 'Best of 3' : 'Single game'}
              </Chip>
            ))}
          </>
        )}
        <Btn tone="primary" onClick={start}>
          <Play className="size-3" aria-hidden /> Start
        </Btn>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Panel>
  );
}

/** Daytime poster rotation on /score and /live — shared by every sport. */
function CourtAdsPanel() {
  const { stoppedToday, inWindow, stopAds, resumeAds, busy, message } = useScoreDaypartAdsAdmin();
  return (
    <Panel
      title="Court-screen posters"
      subtitle="Between 1 and 4 PM the court scoreboard and stream overlay rotate community posters full-screen. Stop them for today if they get in the way."
    >
      <p className="text-xs text-slate-300">
        {inWindow ? (stoppedToday ? '● Stopped for today' : '● Showing now (1–4 PM)') : '● Outside 1–4 PM'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => void stopAds()} disabled={busy || stoppedToday}>
          {busy ? 'Saving…' : 'Stop for today'}
        </Btn>
        <Btn onClick={() => void resumeAds()} disabled={busy || !stoppedToday}>
          Resume
        </Btn>
        <a
          href="/ads"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700"
        >
          Preview
        </a>
      </div>
      {message ? <p className={`text-[11px] ${message.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p> : null}
    </Panel>
  );
}
