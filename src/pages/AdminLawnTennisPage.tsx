import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { db } from '../db';
import { AdminNav } from '../components/AdminNav';
import { HubTabs } from '../components/SportHero';
import { SetupPanel } from '../components/lawnTennis/admin/SetupPanel';
import { DrawPanel } from '../components/lawnTennis/admin/DrawPanel';
import { SchedulePanel } from '../components/lawnTennis/admin/SchedulePanel';
import { LivePanel } from '../components/lawnTennis/admin/LivePanel';
import { Btn, ConfirmBtn, Notice, Panel } from '../components/lawnTennis/admin/ui';
import { useTennisResults, useTournamentContext } from '../components/lawnTennis/useTennisTournament';
import { buildBlankTournament, type PublishedTennisTournament, type TennisTournament } from '../data/tennisTournament';
import { useSportLiveMatch } from '../hooks/useSportLiveMatch';
import {
  buildContext,
  publishTennisTournament,
  saveTennisDraft,
  sameTournamentContent,
  subscribePublishedTennis,
  subscribeTennisDraft,
  syncCategories,
  unpublishTennisTournament,
  validateTournament
} from '../utils/tennisTournament';

type TabKey = 'setup' | 'draw' | 'schedule' | 'publish' | 'live';

/**
 * Lawn Tennis admin (/admin/lawn-tennis). Admins edit a draft (Setup → Draw
 * → Schedule), Publish it for residents, then run match day from Live.
 * Every edit saves the draft immediately; residents see nothing until Publish.
 */
export default function AdminLawnTennisPage() {
  const [draft, setDraft] = useState<TennisTournament | null>(null);
  const [published, setPublished] = useState<PublishedTennisTournament | null>(null);
  const [loaded, setLoaded] = useState({ draft: false, published: false });
  const [tab, setTab] = useState<TabKey>('setup');
  const [saveError, setSaveError] = useState<string | null>(null);
  const live = useSportLiveMatch('tennis');
  const results = useTennisResults();
  const draftCtx = useTournamentContext(draft);
  const publishedCtx = useMemo(() => (published ? buildContext(published, results) : null), [published, results]);

  useEffect(() => {
    const u1 = subscribeTennisDraft(db, (t) => {
      setDraft(t);
      setLoaded((l) => ({ ...l, draft: true }));
    });
    const u2 = subscribePublishedTennis(db, (t) => {
      setPublished(t);
      setLoaded((l) => ({ ...l, published: true }));
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  /** Optimistic local update + whole-draft write. */
  const update = (next: TennisTournament) => {
    setDraft(next);
    saveTennisDraft(db, next)
      .then(() => setSaveError(null))
      .catch((err) => {
        console.error('Saving tennis draft failed:', err);
        setSaveError('Changes are not saving — check your connection.');
      });
  };

  const dirty = !!draft && (!published || !sameTournamentContent(draft, published));
  const tabs: ReadonlyArray<{ key: TabKey; label: string; badge?: string }> = [
    { key: 'setup', label: '1 · Setup' },
    { key: 'draw', label: '2 · Draw' },
    { key: 'schedule', label: '3 · Schedule' },
    { key: 'publish', label: '4 · Publish', ...(dirty ? { badge: '!' } : {}) },
    { key: 'live', label: 'Live' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-6 max-w-7xl mx-auto">
      <AdminNav subtitle="Lawn Tennis" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/sports" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold">
          ← Back to Sports
        </Link>
        <a
          href="/lawn-tennis"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-300 hover:text-white"
        >
          Resident page <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      {!loaded.draft ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !draft ? (
        <Panel
          title="Start the Lawn Tennis tournament"
          subtitle="Creates a draft. Nothing is visible to residents until you publish."
        >
          <div className="flex flex-wrap gap-2">
            <Btn
              tone="primary"
              onClick={() => {
                const blank = buildBlankTournament(new Date().getFullYear());
                update({ ...blank, categories: syncCategories(blank) });
              }}
            >
              Create {new Date().getFullYear()} tournament
            </Btn>
            {published ? (
              <Btn onClick={() => update({ ...published })}>Copy the published tournament into a draft</Btn>
            ) : null}
          </div>
        </Panel>
      ) : (
        <>
          <HubTabs tabs={tabs} active={tab} onChange={setTab} />
          {saveError ? <Notice tone="error">{saveError}</Notice> : null}
          {tab === 'setup' ? <SetupPanel t={draft} onChange={update} /> : null}
          {tab === 'draw' ? <DrawPanel t={draft} onChange={update} /> : null}
          {tab === 'schedule' && draftCtx ? <SchedulePanel t={draft} ctx={draftCtx} onChange={update} /> : null}
          {tab === 'publish' ? (
            <PublishPanel draft={draft} published={published} dirty={dirty} onReset={update} />
          ) : null}
          {tab === 'live' ? <LivePanel published={published} ctx={publishedCtx} live={live} /> : null}
        </>
      )}
    </div>
  );
}

function PublishPanel({
  draft,
  published,
  dirty,
  onReset
}: {
  draft: TennisTournament;
  published: PublishedTennisTournament | null;
  dirty: boolean;
  onReset: (t: TennisTournament) => void;
}) {
  const { errors, warnings } = validateTournament(draft);
  const [msg, setMsg] = useState<string | null>(null);
  const fixtures = draft.fixtures.length;

  const publish = () => {
    publishTennisTournament(db, draft)
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
        subtitle="Copies the draft to the resident Lawn Tennis page. Keep editing the draft any time and publish again — results already played stay attached to their matches."
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
                unpublishTennisTournament(db)
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
            const blank = buildBlankTournament(draft.year + 1);
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
