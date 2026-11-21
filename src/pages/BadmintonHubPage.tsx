import TournamentHubPage from './TournamentHubPage';
import { ResultsView } from '../components/tournament/ResultsView';
import { StatsView } from '../components/tournament/StatsView';

/** Badminton hub (/badminton): the shared tournament hub plus Results and Stats. */
export default function BadmintonHubPage() {
  return (
    <TournamentHubPage
      sport="badminton"
      extraTabs={[
        { key: 'results', label: 'Results', render: () => <ResultsView sport="badminton" /> },
        { key: 'stats', label: 'Stats', render: () => <StatsView sport="badminton" /> }
      ]}
    />
  );
}
