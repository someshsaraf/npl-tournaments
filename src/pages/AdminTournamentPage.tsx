import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { db } from '../db';
import { AdminNav } from '../components/AdminNav';
import { HubTabs } from '../components/SportHero';
import { SetupPanel } from '../components/tournamentAdmin/SetupPanel';
import { DrawPanel } from '../components/tournamentAdmin/DrawPanel';
import { SchedulePanel } from '../components/tournamentAdmin/SchedulePanel';
import { LivePanel } from '../components/tournamentAdmin/LivePanel';
import { ResultsPanel } from '../components/tournamentAdmin/ResultsPanel';
import { RegistrationsPanel } from '../components/tournamentAdmin/RegistrationsPanel';
import { REGISTRATIONS } from '../data/registration';
import { Btn, ConfirmBtn, Notice, Panel } from '../components/tournamentAdmin/ui';
import { useSportResults, useTournamentContext } from '../components/tournamentViews/useTournament';
import { buildBlankTournament, type PublishedTournament, type Tournament } from '../data/tournament';
import { SPORT_LABEL, type Sport } from '../data/tournamentData';
import { sportSlug } from '../data/sports';
import { buildTournamentFromLegacyBadminton } from '../utils/legacyBadminton';
import { useSportLiveMatch } from '../hooks/useSportLiveMatch';
import {
  buildContext,
  publishTournament,
  saveDraft,
  sameTournamentContent,
  subscribeDraft,
  subscribePublished,
  syncCategories,
  unpublishTournament,
  validateTournament
} from '../utils/tournament';

type TabKey = 'registrations' | 'setup' | 'draw' | 'schedule' | 'results' | 'publish' | 'live';

function blankFor(sport: Sport): Tournament {
  const blank = buildBlankTournament(sport, new Date().getFullYear());
  return { ...blank, categories: syncCategories(blank) };
}

/**
 * Tournament console for one sport (/admin/badminton, /admin/lawn-tennis).
 * Opens straight onto the full console — every section editable at any
 * time: Setup (formats, categories, rules) → Draw (teams, pools, players) →
 * Schedule (fixtures) → Results, then Publish for residents and run match
 * day from Live. Edits save to the draft immediately; residents see them
 * after Publish. (Results are live data and show straight away.)
 */
export default function AdminTournamentPage({ sport }: { sport: Sport }) {
  const [draft, setDraft] = useState<Tournament | null>(null);
  const [published, setPublished] = useState<PublishedTournament | null>(null);
  const [loaded, setLoaded] = useState({ draft: false, published: false });
  const [tab, setTab] = useState<TabKey>(REGISTRATIONS[sport] ? 'registrations' : 'setup');
  const [saveError, setSaveError] = useState<string | null>(null);
  const live = useSportLiveMatch(sport);
  const results = useSportResults(sport);
  // No draft yet → work on a blank one; the first edit saves it.
  const working = useMemo(() => draft ?? blankFor(sport), [draft, sport]);
  const draftCtx = useTournamentContext(working);
  const publishedCtx = useMemo(() => (published ? buildContext(published, results) : null), [published, results]);

  useEffect(() => {
    setLoaded({ draft: false, published: false });
    const u1 = subscribeDraft(db, sport, (t) => {
      setDraft(t);
      setLoaded((l) => ({ ...l, draft: true }));
    });
    const u2 = subscribePublished(db, sport, (t) => {
      setPublished(t);
      setLoaded((l) => ({ ...l, published: true }));
    });
    return () => {
      u1();
      u2();
    };
  }, [sport]);

  /** Optimistic local update + whole-draft write. */
  const update = (next: Tournament) => {
    setDraft(next);
    saveDraft(db, next)
      .then(() => setSaveError(null))
      .catch((err: unknown) => {
        console.error('Saving draft failed:', err);
        setSaveError('Changes are not saving — check your connection.');
      });
  };

  const dirty = !!draft && (!published || !sameTournamentContent(draft, published));
  const tabs: ReadonlyArray<{ key: TabKey; label: string; badge?: string }> = [
    ...(REGISTRATIONS[sport] ? [{ key: 'registrations' as const, label: 'Registrations' }] : []),
    { key: 'setup', label: 'Setup' },
    { key: 'draw', label: 'Teams & Draw' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'results', label: 'Results' },
    { key: 'publish', label: 'Publish', ...(dirty ? { badge: '!' } : {}) },
    { key: 'live', label: 'Live' }
  ];
  const label = SPORT_LABEL[sport];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-6 max-w-7xl mx-auto">
      <AdminNav subtitle={label} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/sports" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold">
          ← Back to Sports
        </Link>
        <a
          href={`/${sportSlug(sport)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-300 hover:text-white"
        >
          Resident page <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      {!loaded.draft ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {!draft ? (
            <StartNotice
              sport={sport}
              published={published}
              onLoad={(t) => {
                update(t);
                setTab('setup');
              }}
            />
          ) : null}
          <HubTabs tabs={tabs} active={tab} onChange={setTab} />
          {saveError ? <Notice tone="error">{saveError}</Notice> : null}
          {tab === 'registrations' ? <RegistrationsPanel sport={sport} /> : null}
          {tab === 'setup' ? <SetupPanel t={working} onChange={update} /> : null}
          {tab === 'draw' ? <DrawPanel t={working} onChange={update} /> : null}
          {tab === 'schedule' && draftCtx ? <SchedulePanel t={working} ctx={draftCtx} onChange={update} /> : null}
          {tab === 'results' && draftCtx ? <ResultsPanel t={working} ctx={draftCtx} /> : null}
          {tab === 'publish' ? (
            <PublishPanel draft={working} published={published} dirty={dirty || !draft} onReset={update} />
          ) : null}
          {tab === 'live' ? <LivePanel sport={sport} published={published} ctx={publishedCtx} live={live} /> : null}
        </>
      )}
    </div>
  );
}

/** Shown above the console until the first edit creates this sport's draft. */
function StartNotice({
  sport,
  published,
  onLoad
}: {
  sport: Sport;
  published: PublishedTournament | null;
  onLoad: (t: Tournament) => void;
}) {
  return (
    <Notice tone="warn">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto">
          No {SPORT_LABEL[sport]} tournament yet — set it up below (your first change saves a draft), or start from:
        </span>
        {sport === 'badminton' ? (
          <Btn small onClick={() => onLoad(buildTournamentFromLegacyBadminton())}>
            The NPL 2026 schedule (keeps recorded results)
          </Btn>
        ) : null}
        {published ? (
          <Btn small onClick={() => onLoad({ ...published })}>
            The published tournament
          </Btn>
        ) : null}
      </div>
    </Notice>
  );
}

function PublishPanel({
  draft,
  published,
  dirty,
  onReset
}: {
  draft: Tournament;
  published: PublishedTournament | null;
  dirty: boolean;
  onReset: (t: Tournament) => void;
}) {
  const { errors, warnings } = validateTournament(draft);
  const [msg, setMsg] = useState<string | null>(null);
  const fixtures = draft.fixtures.length;

  const publish = () => {
    publishTournament(db, draft)
      .then(() => setMsg('Published — residents can see the schedule now.'))
      .catch((err) => {
        console.error('Publish failed:', err);
        setMsg('Publish failed — check your connection.');
      });
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Publish"
        subtitle={`Copies the draft to the resident ${SPORT_LABEL[draft.sport]} page. Keep editing the draft any time and publish again — results already played stay attached to their matches.`}
      >
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <Stat label="Categories" value={draft.categories.length} />
          <Stat label="Entries" value={draft.categories.reduce((n, c) => n + c.pools.reduce((m, p) => m + p.entries.length, 0), 0)} />
          <Stat label="Fixtures" value={fixtures} />
        </div>
        <div className="space-y-2">
          {errors.map((e) => (
            <Notice key={e} tone="error">
              {e}
            </Notice>
          ))}
          {warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}
          {errors.length === 0 && warnings.length === 0 ? (
            <Notice tone="ok">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden /> Draft looks complete.
              </span>
            </Notice>
          ) : null}
        </div>
        <p className="text-xs text-slate-400">
          {published
            ? `Last published ${new Date(published.publishedAt).toLocaleString()}. ${dirty ? 'The draft has unpublished changes.' : 'Draft and published copy match.'}`
            : 'Not published yet.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn tone="primary" onClick={publish} disabled={errors.length > 0}>
            {published ? 'Publish changes' : 'Publish schedule'}
          </Btn>
          {published ? (
            <ConfirmBtn
              onConfirm={() =>
                unpublishTournament(db, draft.sport)
                  .then(() => setMsg('Unpublished — residents see "Draw coming soon".'))
                  .catch(() => setMsg('Unpublish failed.'))
              }
              confirmLabel="Hide from residents?"
            >
              Unpublish
            </ConfirmBtn>
          ) : null}
          {published && dirty ? (
            <ConfirmBtn tone="neutral" onConfirm={() => onReset({ ...published })} confirmLabel="Discard draft changes?">
              Revert draft to published
            </ConfirmBtn>
          ) : null}
        </div>
        {msg ? <p className="text-xs text-lime-300">{msg}</p> : null}
      </Panel>

      <Panel title="New season" subtitle="Start over with an empty draft (the published copy stays until you publish again).">
        <ConfirmBtn
          onConfirm={() => {
            const blank = buildBlankTournament(draft.sport, draft.year + 1);
            onReset({ ...blank, categories: syncCategories(blank) });
          }}
          confirmLabel="Erase the whole draft?"
        >
          Start {draft.year + 1} draft
        </ConfirmBtn>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2">
      <p className="text-2xl font-black text-slate-100 tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
