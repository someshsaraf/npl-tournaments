import { useState } from 'react';
import { CalendarClock, ListOrdered, Radio, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { HubTabs, SportHero } from '../components/SportHero';
import { RegisterButton, RegistrationBanner } from '../components/RegistrationBanner';
import { RecordingsView } from '../components/tournament/RecordingsView';
import { closesLabel, registrationOpen } from '../data/registration';
import { useRegistrations } from '../hooks/useRegistrations';
import { SPORT_CARDS } from '../data/sports';

type TabKey = 'schedule' | 'live' | 'pools' | 'knockouts' | 'recordings' | 'rules';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'live', label: 'Live' },
  { key: 'pools', label: 'Pools' },
  { key: 'knockouts', label: 'Knockouts' },
  { key: 'recordings', label: 'Recordings' },
  { key: 'rules', label: 'Rules' }
];

/**
 * Table Tennis hub (/table-tennis) — same layout as Lawn Tennis. Dates,
 * registration, draw and rules aren't set yet, so the tabs say what is coming.
 */
export default function TableTennisPage() {
  const card = SPORT_CARDS.find((c) => c.slug === 'table-tennis')!;
  const registration = useRegistrations().shown['table-tennis'];
  const [tab, setTab] = useState<TabKey>('schedule');
  const afterClose = registration
    ? registrationOpen(registration)
      ? `after registration closes on ${closesLabel(registration)}`
      : 'soon'
    : 'soon';

  return (
    <div className="relative space-y-6">
      <Reveal className="relative z-10">
        <SportHero
          card={card}
          eyebrow={registration ? 'Season 2026' : card.label}
          title={registration?.title ?? card.label}
          meta={registration?.shortDates ?? 'Dates to be announced'}
          actions={registration ? <RegisterButton config={registration} slug={card.slug} /> : undefined}
        />
      </Reveal>

      {registration ? (
        <Reveal delayMs={60} className="relative z-10">
          <RegistrationBanner config={registration} slug={card.slug} sport="table-tennis" />
        </Reveal>
      ) : null}

      <Reveal delayMs={120} className="relative z-10 space-y-4">
        <HubTabs tabs={TABS} active={tab} onChange={setTab} />
        <div>
          {tab === 'schedule' ? (
            <NotYet icon={CalendarClock} title="Schedule coming soon" text={`The match schedule will be published here ${afterClose}.`} />
          ) : null}
          {tab === 'live' ? (
            <NotYet
              icon={Radio}
              title="Live scores during the tournament"
              text={`Live scores and the stream will appear here on match days${registration ? ` (${registration.shortDates})` : ''}.`}
            />
          ) : null}
          {tab === 'pools' ? <NotYet icon={ListOrdered} title="Pools coming soon" text={`Pool tables will appear once the draw is made ${afterClose}.`} /> : null}
          {tab === 'knockouts' ? <NotYet icon={Swords} title="Knockouts coming soon" text="The knockout bracket will appear here once the pools are played." /> : null}
          {tab === 'recordings' ? <RecordingsView sport="table-tennis" /> : null}
          {tab === 'rules' ? <NotYet icon={Trophy} title="Rules not available yet" text="The Table Tennis rules and match format will be published here before the tournament." /> : null}
        </div>
      </Reveal>
    </div>
  );
}

function NotYet({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-soft px-6 py-12 text-center space-y-2">
      <Icon className="size-8 mx-auto text-emerald-600" aria-hidden />
      <p className="portal-display text-3xl text-ink tracking-wide">{title}</p>
      <p className="text-sm text-slate-500 max-w-md mx-auto">{text}</p>
    </div>
  );
}
