import { StatusBadge } from './StatusBadge';

type MatchCardProps = {
  date?: string;
  time?: string;
  category?: string;
  stage?: string;
  teamA: string;
  teamB: string;
  scoreA?: number;
  scoreB?: number;
  status: 'completed' | 'scheduled' | 'live';
  winnerName?: string;
  result?: string;
};

function parseDateBadge(dateStr?: string) {
  if (!dateStr) return { day: '—', month: '' };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return { day: parts[0], month: parts[1]?.slice(0, 3) ?? '' };
  }
  return { day: dateStr.slice(0, 2), month: dateStr.slice(3, 6) };
}

export function MatchCard({
  date,
  time,
  category,
  stage,
  teamA,
  teamB,
  scoreA,
  scoreB,
  status,
  winnerName,
  result
}: MatchCardProps) {
  const badge = parseDateBadge(date);
  const showScore = scoreA !== undefined && scoreB !== undefined;
  const done = status === 'completed';

  return (
    <article className="gk-match-card">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {date ? (
          <div className="gk-date-badge">
            <span className="day">{badge.day}</span>
            <span className="month">{badge.month}</span>
          </div>
        ) : null}

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {category ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gk-muted)]">
                {category}
                {stage ? ` · ${stage}` : ''}
              </span>
            ) : null}
            {time ? (
              <span className="text-[10px] font-mono text-[var(--gk-gold)]">{time}</span>
            ) : null}
            <StatusBadge
              status={status === 'live' ? 'live' : done ? 'completed' : 'scheduled'}
              pulse={status === 'live'}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <p className="font-bold text-sm sm:text-base text-[var(--gk-ink)] truncate text-right">
              {teamA}
            </p>
            {showScore ? (
              <div className="gk-score px-2">
                {scoreA}
                <span className="text-[var(--gk-muted)] mx-1 text-2xl">:</span>
                {scoreB}
              </div>
            ) : (
              <span className="gk-vs">VS</span>
            )}
            <p className="font-bold text-sm sm:text-base text-[var(--gk-ink)] truncate text-left">
              {teamB}
            </p>
          </div>

          {done && winnerName ? (
            <p className="text-xs text-[var(--gk-green)] font-semibold uppercase tracking-wide">
              Winner: {winnerName}
              {result ? ` · ${result}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default MatchCard;
