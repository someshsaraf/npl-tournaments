import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Monitor } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { HubTabs, SportHero } from '../components/SportHero';
import { ScheduleView } from '../components/tournament/ScheduleView';
import { ResultsView } from '../components/tournament/ResultsView';
import { StatsView } from '../components/tournament/StatsView';
import { TeamsView } from '../components/tournament/TeamsView';
import { RulesView } from '../components/tournament/RulesView';
import { RecordingsView } from '../components/tournament/RecordingsView';
import { LiveView } from '../components/tournament/LiveView';
import { sportCardBySport } from '../data/sports';
import { isMatchOnCourt, useSportLiveMatch } from '../hooks/useSportLiveMatch';

type TabKey = 'schedule' | 'results' | 'stats' | 'teams' | 'live' | 'recordings' | 'rules';

/** Badminton hub (/badminton) — the existing NPL badminton views, one tab each. */
export default function BadmintonHubPage() {
  const card = sportCardBySport('badminton');
  const live = isMatchOnCourt(useSportLiveMatch('badminton'));
  const [tab, setTab] = useState<TabKey>(live ? 'live' : 'schedule');

  const tabs: ReadonlyArray<{ key: TabKey; label: string; badge?: string }> = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'live', label: 'Live', ...(live ? { badge: '●' } : {}) },
    { key: 'results', label: 'Results' },
    { key: 'stats', label: 'Stats' },
    { key: 'teams', label: 'Teams' },
    { key: 'recordings', label: 'Recordings' },
    { key: 'rules', label: 'Rules' }
  ];

  return (
    <div className="relative space-y-6">
      <Reveal className="relative z-10">
        <SportHero
          card={card}
          eyebrow="NPL 2026"
          meta="31 Jul – 9 Aug 2026 · Nature Walk Courts"
          live={live}
          actions={
            <>
              <Link
                to="/photos?sport=badminton"
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-950 font-bold text-xs uppercase tracking-wide px-4 py-2.5 shadow-lg"
              >
                <Camera className="size-3.5" aria-hidden />
                Photos
              </Link>
              <Link
                to="/score/badminton"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white border border-white/30 font-bold text-xs uppercase tracking-wide px-4 py-2.5 backdrop-blur-sm hover:bg-white/20"
              >
                <Monitor className="size-3.5" aria-hidden />
                Court scoreboard
              </Link>
            </>
          }
        />
      </Reveal>

      <Reveal delayMs={100} className="relative z-10 space-y-4">
        <HubTabs tabs={tabs} active={tab} onChange={setTab} />
        <div>
          {tab === 'schedule' ? <ScheduleView sport="badminton" /> : null}
          {tab === 'results' ? <ResultsView sport="badminton" /> : null}
          {tab === 'stats' ? <StatsView sport="badminton" /> : null}
          {tab === 'teams' ? <TeamsView /> : null}
          {tab === 'live' ? <LiveView sport="badminton" /> : null}
          {tab === 'recordings' ? <RecordingsView sport="badminton" /> : null}
          {tab === 'rules' ? <RulesView sport="badminton" /> : null}
        </div>
      </Reveal>
    </div>
  );
}
