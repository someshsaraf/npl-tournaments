import { StatusBadge } from './StatusBadge';

type MatchListItemProps = {
  time?: string;
  category?: string;
  stage?: string;
  details: string;
  meta?: string;
  status: 'completed' | 'scheduled';
  winnerName?: string;
  result?: string;
};

export function MatchListItem({
  time,
  category,
  stage,
  details,
  meta,
  status,
  winnerName,
  result
}: MatchListItemProps) {
  const done = status === 'completed';

  return (
    <li className="portal-list-item">
      <div className="flex flex-col sm:grid sm:grid-cols-[4.5rem_1fr_auto] gap-2 sm:gap-4">
        {time ? (
          <span className="font-mono text-xs font-semibold text-[var(--pine-clay)] sm:pt-1">
            {time}
          </span>
        ) : meta ? (
          <span className="font-mono text-xs font-semibold text-[var(--pine-clay)] sm:pt-1">
            {meta}
          </span>
        ) : (
          <span className="hidden sm:block" />
        )}

        <div className="min-w-0 space-y-1">
          {(category || stage) && (
            <p className="text-[11px] uppercase tracking-wide text-[var(--pine-sky)] font-semibold truncate">
              {category}
              {stage ? (
                <>
                  <span className="text-[var(--pine-line)] mx-1">·</span>
                  <span className="text-[var(--pine-muted)] normal-case tracking-normal font-medium">
                    {stage}
                  </span>
                </>
              ) : null}
            </p>
          )}
          <p className="font-semibold text-[var(--pine-ink)] leading-snug">{details}</p>
          {done && winnerName ? (
            <p className="text-xs text-[var(--pine-leaf)] font-medium">
              Winner: {winnerName}
              {result ? ` · ${result}` : ''}
            </p>
          ) : null}
        </div>

        <div className="sm:justify-self-end sm:self-center">
          <StatusBadge status={done ? 'completed' : 'scheduled'} />
        </div>
      </div>
    </li>
  );
}

export default MatchListItem;
