import { useState } from 'react';
import { X } from 'lucide-react';
import { ref, remove, set } from '../../lib/realtime';
import { db } from '../../db';
import {
  closesLabel,
  groupDays,
  isIsoDay,
  longDatesLabel,
  registrationSettingsPath,
  settingsOf,
  type RegistrationConfig,
  type RegistrationKey,
  type RegistrationSettings
} from '../../data/registration';
import { Btn, ConfirmBtn, FieldLabel, Notice, Panel, inputBaseCls } from './ui';

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`)
  );

/**
 * Edit a sport's match days, registration closing date, and whether
 * residents see registration at all. Saved to registrationSettings/{sport}
 * and picked up live by every page and the sign-up API.
 */
export function RegistrationDatesPanel({
  sport,
  config,
  customised
}: {
  sport: RegistrationKey;
  config: RegistrationConfig;
  /** Are admin settings stored (vs the built-in defaults)? */
  customised: boolean;
}) {
  const saved = settingsOf(config);
  const [draft, setDraft] = useState<RegistrationSettings>(saved);
  const [newDay, setNewDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  // Follow saves/resets (also from another admin's screen).
  const savedKey = JSON.stringify(saved);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey);
    setDraft(saved);
  }

  const days = [...new Set(draft.days)].sort();
  const dirty = JSON.stringify({ ...draft, days }) !== JSON.stringify({ ...saved, days: [...saved.days].sort() });
  const closeAfterStart = days.length > 0 && isIsoDay(draft.closesOn) && draft.closesOn >= days[0];
  const canShow = days.length > 0 && isIsoDay(draft.closesOn);

  const change = (patch: Partial<RegistrationSettings>) => {
    setMsg(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const addDay = () => {
    if (!isIsoDay(newDay)) return;
    change({ days: [...new Set([...draft.days, newDay])].sort() });
    setNewDay('');
  };

  const save = async () => {
    if (!isIsoDay(draft.closesOn)) {
      setMsg({ tone: 'error', text: 'Pick the last day to register.' });
      return;
    }
    setBusy(true);
    try {
      await set(ref(db, registrationSettingsPath(sport)), {
        days,
        closesOn: draft.closesOn,
        visible: draft.visible && canShow,
        updatedAt: new Date().toISOString()
      });
      setMsg({ tone: 'ok', text: 'Saved — residents see the new dates straight away.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  const resetToDefaults = async () => {
    setBusy(true);
    try {
      await remove(ref(db, registrationSettingsPath(sport)));
      setMsg({ tone: 'ok', text: 'Back to the built-in dates.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Reset failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Tournament & registration dates"
      subtitle={
        config.hidden
          ? 'Registration is hidden from residents. Set the dates and tick “Show registration to residents” to open it.'
          : `Residents see: ${config.dates} · registration closes ${closesLabel(config)} at 11:59 PM.`
      }
      actions={
        customised ? (
          <ConfirmBtn small disabled={busy} onConfirm={() => void resetToDefaults()} confirmLabel="Reset dates?">
            Reset to built-in dates
          </ConfirmBtn>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel>Match days</FieldLabel>
          {days.length === 0 ? (
            <p className="text-sm text-slate-500">No match days yet — residents see “Dates to be announced”.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {days.map((d) => (
                <li key={d} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 pl-3 pr-1.5 py-1 text-sm">
                  {dayLabel(d)}
                  <button
                    type="button"
                    onClick={() => change({ days: draft.days.filter((x) => x !== d) })}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                    aria-label={`Remove ${dayLabel(d)}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDay();
                }
              }}
              className={`${inputBaseCls} [color-scheme:dark]`}
              aria-label="Match day to add"
            />
            <Btn small onClick={addDay} disabled={!isIsoDay(newDay)}>
              Add day
            </Btn>
          </div>
          {days.length > 0 ? (
            <p className="text-xs text-slate-400">
              Shown as: <span className="font-semibold text-slate-200">{longDatesLabel(groupDays(days))}</span>
              <span className="block text-slate-500">Back-to-back days are grouped into one weekend.</span>
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <label className="block">
            <FieldLabel>Last day to register</FieldLabel>
            <input
              type="date"
              value={draft.closesOn}
              onChange={(e) => change({ closesOn: e.target.value })}
              className={`${inputBaseCls} [color-scheme:dark]`}
            />
            <span className="block mt-1 text-xs text-slate-500">
              Closes at 11:59 PM India time. Staff can still add late entries after that.
            </span>
          </label>
          <label className={`flex items-start gap-3 ${canShow ? 'cursor-pointer' : 'opacity-60'}`}>
            <input
              type="checkbox"
              checked={draft.visible && canShow}
              disabled={!canShow}
              onChange={(e) => change({ visible: e.target.checked })}
              className="mt-0.5 size-4 accent-lime-400"
            />
            <span className="text-sm">
              <span className="font-semibold text-slate-100">Show registration to residents</span>
              <span className="block text-xs text-slate-500">
                {canShow
                  ? 'Dates, the Register button and the form. Untick to hide them (registrations already made stay here).'
                  : 'Add at least one match day and the last day to register first.'}
              </span>
            </span>
          </label>
        </div>
      </div>

      {closeAfterStart ? <Notice tone="warn">Registration closes on or after the first match day — is that intended?</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <Btn tone="primary" onClick={() => void save()} disabled={busy || !dirty}>
          Save dates
        </Btn>
        <Btn
          onClick={() => {
            setDraft(saved);
            setMsg(null);
          }}
          disabled={busy || !dirty}
        >
          Undo changes
        </Btn>
      </div>
    </Panel>
  );
}
