import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, set, onValue } from 'firebase/database';
import { db, LIVE_SCORE_DELAY_MS_PATH, YOUTUBE_LIVE_URL_PATH } from '../firebase';
import {
  FIXTURES,
  FIXTURE_DATES,
  INITIAL_MATCH,
  MAX_POINTS_OPTIONS,
  BEST_OF_OPTIONS,
  isBestOf,
  isMaxPoints
} from '../data/tournamentData';
import type { BestOf, MatchState, Fixture, CompletedMatch, MaxPoints } from '../data/tournamentData';
import { isValidYouTubeLiveUrl, parseYouTubeVideoId } from '../utils/youtube';
import {
  completedMatchesFromFirebase,
  mergeFixturesWithResults
} from '../utils/completedMatches';
import {
  DEFAULT_LIVE_SCORE_DELAY_MS,
  MAX_LIVE_SCORE_DELAY_MS,
  MIN_LIVE_SCORE_DELAY_MS,
  delayMsToSeconds,
  delaySecondsToMs,
  parseLiveScoreDelayMs
} from '../utils/liveScoreDelay';
import { normalizeMatchState } from '../utils/matchState';
import { AdminNav } from '../components/AdminNav';
import { buildCustomMatchState, sanitizeLabel } from '../utils/customMatch';
import { useScoreDaypartAdsAdmin } from '../hooks/useScoreDaypartAds';

const LIVE_DELAY_PRESETS_SECONDS = [0, 5, 7, 10, 15] as const;

const CUSTOM_MATCH_STAGES = [
  'Exhibition',
  'Friendly',
  'Custom',
  'Group Stage',
  'Semi Final',
  'Final'
] as const;

function isCustomMatchId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.trim().startsWith('custom-');
}

export const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [completedById, setCompletedById] = useState<Record<string, CompletedMatch>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(FIXTURE_DATES[0] ?? 'All');
  const [selectedMaxPoints, setSelectedMaxPoints] = useState<MaxPoints>(11);
  const [selectedBestOf, setSelectedBestOf] = useState<BestOf>(1);

  const fixtureCategories = Array.from(new Set(FIXTURES.map((f) => f.category)));
  const [customSideA, setCustomSideA] = useState('');
  const [customSideB, setCustomSideB] = useState('');
  const [customCategory, setCustomCategory] = useState(fixtureCategories[0] ?? 'Exhibition');
  const [customCategoryOther, setCustomCategoryOther] = useState('');
  const [customStage, setCustomStage] = useState<string>(CUSTOM_MATCH_STAGES[0]);
  const [customMaxPoints, setCustomMaxPoints] = useState<MaxPoints>(11);
  const [customBestOf, setCustomBestOf] = useState<BestOf>(1);
  const [customMatchError, setCustomMatchError] = useState<string | null>(null);
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const [youtubeSaveMessage, setYoutubeSaveMessage] = useState<string | null>(null);
  const [isSavingYoutube, setIsSavingYoutube] = useState(false);
  const [delaySecondsDraft, setDelaySecondsDraft] = useState(
    String(delayMsToSeconds(DEFAULT_LIVE_SCORE_DELAY_MS))
  );
  const [delaySaveMessage, setDelaySaveMessage] = useState<string | null>(null);
  const [isSavingDelay, setIsSavingDelay] = useState(false);

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubscribeMatch = onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMatch(normalizeMatchState(data));
    });

    const completedRef = ref(db, 'completedMatches');
    const unsubscribeCompleted = onValue(completedRef, (snapshot) => {
      setCompletedById(completedMatchesFromFirebase(snapshot.val()));
    });

    const youtubeRef = ref(db, YOUTUBE_LIVE_URL_PATH);
    const unsubscribeYoutube = onValue(youtubeRef, (snapshot) => {
      const val = snapshot.val();
      setYoutubeDraft(typeof val === 'string' ? val : '');
    });

    const delayRef = ref(db, LIVE_SCORE_DELAY_MS_PATH);
    const unsubscribeDelay = onValue(delayRef, (snapshot) => {
      setDelaySecondsDraft(String(delayMsToSeconds(snapshot.val())));
    });

    return () => {
      unsubscribeMatch();
      unsubscribeCompleted();
      unsubscribeYoutube();
      unsubscribeDelay();
    };
  }, []);

  const updateMatchState = (newMatchState: MatchState) => {
    setMatch(newMatchState);
    set(ref(db, 'currentMatch'), newMatchState).catch((err) => {
      console.error('Failed to sync match state to Firebase:', err);
    });
  };

  const handleStartFixture = (fixture: Fixture, pointsLimit: MaxPoints, bestOf: BestOf = selectedBestOf) => {
    if (!fixture || !isMaxPoints(pointsLimit)) return;
    if (!isBestOf(bestOf)) return;

    const sides = fixture.details.split(/\s+vs\s+/i);
    const stripMatch = (value: string) =>
      value.replace(/\s*\(Match\s+\d+\)\s*$/i, '').trim();

    const left = stripMatch(fixture.teamA || sides[0] || match.player1);
    const right = stripMatch(fixture.teamB || sides[1] || match.player2);

    const updatedState: MatchState = {
      ...match,
      currentMatchId: fixture.id,
      category: fixture.category,
      stage: fixture.stage,
      teamA: left || match.teamA,
      teamB: right || match.teamB,
      player1: left || match.player1,
      player2: right || match.player2,
      score1: 0,
      score2: 0,
      maxPoints: pointsLimit,
      bestOf,
      gameNumber: 1,
      gameScores: [],
      gamesWon1: 0,
      gamesWon2: 0,
      matchWinner: null,
      server: 1,
      servingSide: 'right',
      deuceActive: false,
      gameWinner: null,
      isTrump: false,
      trumpTeam: null
    };
    updateMatchState(updatedState);
    navigate('/admin/score');
  };

  /**
   * Start an ad-hoc match that is not on the fixture schedule.
   * Concurrency: single Firebase write via updateMatchState; no shared mutable globals.
   * Security: labels trimmed/length-capped; ids generated locally (not user-supplied).
   */
  const handleStartCustomMatch = () => {
    setCustomMatchError(null);
    try {
      const category =
        customCategory === '__other__'
          ? sanitizeLabel(customCategoryOther, 'Category')
          : sanitizeLabel(customCategory, 'Category');
      const stage = sanitizeLabel(customStage, 'Stage');
      updateMatchState(
        buildCustomMatchState(match, {
          sideA: customSideA,
          sideB: customSideB,
          maxPoints: customMaxPoints,
          bestOf: customBestOf,
          category,
          stage
        })
      );
      setSelectedMaxPoints(customMaxPoints);
      setSelectedBestOf(customBestOf);
      navigate('/admin/score');
    } catch (err) {
      setCustomMatchError(err instanceof Error ? err.message : 'Could not start custom match.');
    }
  };

  /**
   * Persist YouTube URL in settings (shared) and mirror onto currentMatch for /live.
   * Validation: empty clears; otherwise must be a valid YouTube URL.
   */
  const handleSaveYoutubeLiveUrl = async () => {
    const raw = typeof youtubeDraft === 'string' ? youtubeDraft.trim() : '';
    if (raw && !isValidYouTubeLiveUrl(raw)) {
      setYoutubeSaveMessage('Enter a valid YouTube watch, live, or share URL.');
      return;
    }
    setIsSavingYoutube(true);
    setYoutubeSaveMessage(null);
    try {
      await set(ref(db, YOUTUBE_LIVE_URL_PATH), raw);
      await set(ref(db, 'currentMatch'), { ...match, youtubeLiveUrl: raw });
      setMatch((prev) => ({ ...prev, youtubeLiveUrl: raw }));
      setYoutubeSaveMessage(raw ? 'YouTube link saved for all admins.' : 'YouTube link cleared.');
    } catch (err) {
      console.error('Failed to save YouTube URL:', err);
      setYoutubeSaveMessage('Failed to save YouTube link. Check connection.');
    } finally {
      setIsSavingYoutube(false);
    }
  };

  const handleClearYoutubeDraft = async () => {
    setYoutubeDraft('');
    setIsSavingYoutube(true);
    setYoutubeSaveMessage(null);
    try {
      await set(ref(db, YOUTUBE_LIVE_URL_PATH), '');
      await set(ref(db, 'currentMatch'), { ...match, youtubeLiveUrl: '' });
      setMatch((prev) => ({ ...prev, youtubeLiveUrl: '' }));
      setYoutubeSaveMessage('YouTube link cleared.');
    } catch (err) {
      console.error('Failed to clear YouTube URL:', err);
      setYoutubeSaveMessage('Failed to clear YouTube link.');
    } finally {
      setIsSavingYoutube(false);
    }
  };

  /**
   * Persist /live score broadcast delay (seconds in UI → ms in Firebase).
   * Validation: finite number in [0, 30] seconds.
   */
  const handleSaveLiveScoreDelay = async (secondsOverride?: number) => {
    const seconds =
      typeof secondsOverride === 'number' && Number.isFinite(secondsOverride)
        ? secondsOverride
        : Number(delaySecondsDraft);
    if (!Number.isFinite(seconds)) {
      setDelaySaveMessage('Enter a delay between 0 and 30 seconds.');
      return;
    }
    const ms = delaySecondsToMs(seconds);
    const clampedSeconds = delayMsToSeconds(ms);
    if (
      seconds < MIN_LIVE_SCORE_DELAY_MS / 1000 ||
      seconds > MAX_LIVE_SCORE_DELAY_MS / 1000
    ) {
      setDelaySaveMessage('Enter a delay between 0 and 30 seconds.');
      return;
    }

    setIsSavingDelay(true);
    setDelaySaveMessage(null);
    try {
      await set(ref(db, LIVE_SCORE_DELAY_MS_PATH), parseLiveScoreDelayMs(ms));
      setDelaySecondsDraft(String(clampedSeconds));
      setDelaySaveMessage(
        clampedSeconds === 0
          ? 'Live score delay cleared (instant updates on /live).'
          : `Live score delay set to ${clampedSeconds}s for /live.`
      );
    } catch (err) {
      console.error('Failed to save live score delay:', err);
      setDelaySaveMessage('Failed to save delay. Check connection.');
    } finally {
      setIsSavingDelay(false);
    }
  };

  const categories = ['All', ...fixtureCategories];
  const dates = ['All', ...FIXTURE_DATES];

  const fixturesWithResults = mergeFixturesWithResults(FIXTURES, completedById);

  const filteredFixtures = fixturesWithResults.filter((f) => {
    const dateOk = selectedDate === 'All' || f.date === selectedDate;
    const categoryOk = selectedCategory === 'All' || f.category === selectedCategory;
    return dateOk && categoryOk;
  });

  const fixturesByDate = filteredFixtures.reduce<Record<string, Fixture[]>>((acc, fixture) => {
    if (!acc[fixture.date]) acc[fixture.date] = [];
    acc[fixture.date].push(fixture);
    return acc;
  }, {});

  const completedCount = Object.keys(completedById).length;
  const isCustomLiveMatch = isCustomMatchId(match.currentMatchId);
  const youtubeDraftValid = isValidYouTubeLiveUrl(youtubeDraft);
  const youtubeConfigured = !!parseYouTubeVideoId(youtubeDraft);
  const delaySecondsParsed = Number(delaySecondsDraft);
  const delayDraftValid =
    Number.isFinite(delaySecondsParsed) &&
    delaySecondsParsed >= MIN_LIVE_SCORE_DELAY_MS / 1000 &&
    delaySecondsParsed <= MAX_LIVE_SCORE_DELAY_MS / 1000;

  const {
    stoppedToday: scoreAdsStoppedToday,
    inWindow: scoreAdsInWindow,
    stopAds: stopScoreDaypartAds,
    resumeAds: resumeScoreDaypartAds,
    busy: scoreAdsBusy,
    message: scoreAdsMessage
  } = useScoreDaypartAdsAdmin();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">

      <AdminNav />
      <p className="text-[11px] text-slate-500 text-center max-w-lg mx-auto -mt-4">
        Pick a fixture below (or start a custom match) to open the score desk. After you save,
        you return here to choose the next game.
      </p>

      {/* Persistent YouTube only — scoring lives on /admin/score */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label htmlFor="youtube-live-url" className="text-sm font-semibold text-slate-200">
            YouTube Live Link
          </label>
          <span className="text-[11px] text-slate-500">
            Saved for all admins · used by <code className="text-indigo-300">/live</code>
            {youtubeConfigured ? (
              <span className="ml-2 text-emerald-400 font-semibold">● Linked</span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="youtube-live-url"
            type="url"
            value={youtubeDraft}
            onChange={(e) => {
              setYoutubeDraft(e.target.value);
              setYoutubeSaveMessage(null);
            }}
            placeholder="https://www.youtube.com/watch?v=… or /live/…"
            className={`flex-1 bg-slate-950 border rounded-lg p-2.5 text-sm text-white focus:outline-none ${
              youtubeDraft.trim() && !youtubeDraftValid
                ? 'border-red-500 focus:border-red-400'
                : 'border-slate-700 focus:border-indigo-500'
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void handleSaveYoutubeLiveUrl()}
            disabled={isSavingYoutube || (youtubeDraft.trim() !== '' && !youtubeDraftValid)}
            className="text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
          >
            {isSavingYoutube ? 'Saving…' : 'Save Link'}
          </button>
          <button
            type="button"
            onClick={() => void handleClearYoutubeDraft()}
            disabled={isSavingYoutube || !youtubeDraft}
            className="text-xs text-slate-300 hover:text-white bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
        {youtubeDraft.trim() && !youtubeDraftValid && (
          <p className="text-[11px] text-red-400">
            Enter a valid YouTube watch, live, or share URL.
          </p>
        )}
        {youtubeSaveMessage && (
          <p
            className={`text-[11px] ${
              youtubeSaveMessage.startsWith('Failed') || youtubeSaveMessage.startsWith('Enter')
                ? 'text-red-400'
                : 'text-emerald-400'
            }`}
          >
            {youtubeSaveMessage}
          </p>
        )}
      </div>

      {/* /score afternoon fullscreen ads (1–4 PM) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Score & Live Ads (1–4 PM)</h2>
          <span className="text-[11px] text-slate-500">
            Fullscreen on <code className="text-indigo-300">/score</code> +{' '}
            <code className="text-indigo-300">/live</code>
            {scoreAdsInWindow ? (
              scoreAdsStoppedToday ? (
                <span className="ml-2 text-amber-400 font-semibold">● Stopped</span>
              ) : (
                <span className="ml-2 text-emerald-400 font-semibold">● Live window</span>
              )
            ) : (
              <span className="ml-2 text-slate-500 font-semibold">● Outside 1–4 PM</span>
            )}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Between 1:00 PM and 4:00 PM local time, <code className="text-slate-400">/score</code> and{' '}
          <code className="text-slate-400">/live</code> rotate community posters fullscreen. Stop
          anytime before 4 PM; resumes tomorrow unless you stop again.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => void stopScoreDaypartAds()}
            disabled={scoreAdsBusy || scoreAdsStoppedToday}
            className="text-xs font-bold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg transition-colors"
          >
            {scoreAdsBusy ? 'Saving…' : 'Stop Score Ads'}
          </button>
          <button
            type="button"
            onClick={() => void resumeScoreDaypartAds()}
            disabled={scoreAdsBusy || !scoreAdsStoppedToday}
            className="text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg transition-colors"
          >
            Resume Score Ads
          </button>
          <a
            href="/ads"
            className="text-xs font-bold text-center bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 rounded-lg transition-colors"
          >
            Open /ads preview
          </a>
        </div>
        {scoreAdsMessage ? (
          <p
            className={`text-[11px] ${
              scoreAdsMessage.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {scoreAdsMessage}
          </p>
        ) : null}
      </div>

      {/* /live score broadcast delay */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label htmlFor="live-score-delay" className="text-sm font-semibold text-slate-200">
            Live Score Delay
          </label>
          <span className="text-[11px] text-slate-500">
            Broadcast lag for <code className="text-indigo-300">/live</code> only · 0–30s
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Score Desk and <code className="text-slate-400">/score</code> stay instant. Use this to
          align the overlay with stream latency.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2">
            <input
              id="live-score-delay"
              type="number"
              min={0}
              max={30}
              step={1}
              value={delaySecondsDraft}
              onChange={(e) => {
                setDelaySecondsDraft(e.target.value);
                setDelaySaveMessage(null);
              }}
              className={`w-24 bg-slate-950 border rounded-lg p-2.5 text-sm text-white focus:outline-none ${
                delaySecondsDraft !== '' && !delayDraftValid
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-700 focus:border-indigo-500'
              }`}
              inputMode="numeric"
            />
            <span className="text-sm text-slate-400">seconds</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveLiveScoreDelay()}
            disabled={isSavingDelay || !delayDraftValid}
            className="text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
          >
            {isSavingDelay ? 'Saving…' : 'Save Delay'}
          </button>
          <div className="flex flex-wrap gap-1.5">
            {LIVE_DELAY_PRESETS_SECONDS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => void handleSaveLiveScoreDelay(sec)}
                disabled={isSavingDelay}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  delayDraftValid && delaySecondsParsed === sec
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
              >
                {sec === 0 ? '0s (off)' : `${sec}s`}
              </button>
            ))}
          </div>
        </div>
        {delaySecondsDraft !== '' && !delayDraftValid && (
          <p className="text-[11px] text-red-400">Enter a delay between 0 and 30 seconds.</p>
        )}
        {delaySaveMessage && (
          <p
            className={`text-[11px] ${
              delaySaveMessage.startsWith('Failed') || delaySaveMessage.startsWith('Enter')
                ? 'text-red-400'
                : 'text-emerald-400'
            }`}
          >
            {delaySaveMessage}
          </p>
        )}
      </div>

      {/* 1. Tournament Fixtures — start a match */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold text-indigo-300">Tournament Fixtures</h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredFixtures.length} / {FIXTURES.length} matches
                {completedCount > 0 ? ` · ${completedCount} completed` : ''}
              </span>
              <div className="flex items-center flex-wrap gap-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mr-1">
                  Start as
                </span>
                <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
                  {MAX_POINTS_OPTIONS.map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setSelectedMaxPoints(pts)}
                      className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                        selectedMaxPoints === pts ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Default fixture start format: ${pts} points`}
                    >
                      {pts} Points
                    </button>
                  ))}
                </div>
                <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
                  {BEST_OF_OPTIONS.map((bo) => (
                    <button
                      key={bo}
                      type="button"
                      onClick={() => setSelectedBestOf(bo)}
                      className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                        selectedBestOf === bo ? 'bg-violet-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Best of ${bo} games`}
                    >
                      BO{bo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</p>
            <div className="flex items-center space-x-2 overflow-x-auto max-w-full pb-1">
              {dates.map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedDate === date
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</p>
            <div className="flex items-center space-x-2 overflow-x-auto max-w-full pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white font-bold shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 max-h-[640px] overflow-y-auto pr-1">
          {Object.keys(fixturesByDate).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No fixtures for this filter.</p>
          )}
          {Object.entries(fixturesByDate).map(([date, dayFixtures]) => (
            <div key={date} className="space-y-3">
              <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 py-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-400">{date}</h4>
                <span className="text-[11px] text-slate-500">{dayFixtures.length} matches</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dayFixtures.map((fixture) => {
                  const isLive = match.currentMatchId === fixture.id;
                  const isCompleted = fixture.status === 'completed';
                  return (
                    <div
                      key={fixture.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isLive
                          ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                          : isCompleted
                            ? 'bg-emerald-950/30 border-emerald-700/50'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1.5 gap-2">
                          <span className="font-mono">{fixture.time}</span>
                          <span className="font-semibold text-indigo-400 text-right">{fixture.category}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-100">{fixture.details}</p>
                        {isCompleted && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                              Match completed · {fixture.result}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Winner: {fixture.winnerName}
                              {fixture.completedDate
                                ? ` · ${fixture.completedDate} ${fixture.completedTime ?? ''}`
                                : ''}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3.5 flex justify-between items-center pt-2 border-t border-slate-800/80 gap-2">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {isCompleted ? 'Completed' : fixture.stage}
                        </span>
                        <div className="flex items-center flex-wrap justify-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartFixture(fixture, selectedMaxPoints, selectedBestOf)}
                            className={`text-[11px] px-2.5 py-1 rounded font-bold transition-all ${
                              isLive &&
                              match.maxPoints === selectedMaxPoints &&
                              (match.bestOf ?? 1) === selectedBestOf
                                ? 'bg-emerald-500 text-slate-950 shadow'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                            title={`Start as ${selectedMaxPoints} point · best of ${selectedBestOf}`}
                          >
                            {isLive &&
                            match.maxPoints === selectedMaxPoints &&
                            (match.bestOf ?? 1) === selectedBestOf
                              ? `Live (${selectedMaxPoints}p BO${selectedBestOf})`
                              : isCompleted
                                ? `Replay ${selectedMaxPoints}p BO${selectedBestOf}`
                                : `Start ${selectedMaxPoints}p BO${selectedBestOf}`}
                          </button>
                          {MAX_POINTS_OPTIONS.filter((pts) => pts !== selectedMaxPoints).map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() => handleStartFixture(fixture, pts, selectedBestOf)}
                              className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${
                                isLive && match.maxPoints === pts && (match.bestOf ?? 1) === selectedBestOf
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
                              }`}
                              title={`Start as ${pts} point · best of ${selectedBestOf}`}
                            >
                              {isLive && match.maxPoints === pts && (match.bestOf ?? 1) === selectedBestOf
                                ? `Live ${pts}p`
                                : `${pts}p`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Custom match (not on fixture schedule) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-violet-300">Start Custom Match</h3>
            <p className="text-xs text-slate-400 mt-1">
              Use for exhibition / friendly / unscheduled games. Does not change the fixture list.
              Results still save to Completed Matches under a <span className="font-mono text-slate-300">custom-*</span> id.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Side A / Player 1
            </span>
            <input
              type="text"
              value={customSideA}
              onChange={(e) => setCustomSideA(e.target.value)}
              maxLength={80}
              placeholder="e.g. Nitin Verma"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Side B / Player 2
            </span>
            <input
              type="text"
              value={customSideB}
              onChange={(e) => setCustomSideB(e.target.value)}
              maxLength={80}
              placeholder="e.g. Sambit Mahapatra"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Category
            </span>
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {fixtureCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Exhibition">Exhibition</option>
              <option value="__other__">Other (type below)</option>
            </select>
            {customCategory === '__other__' && (
              <input
                type="text"
                value={customCategoryOther}
                onChange={(e) => setCustomCategoryOther(e.target.value)}
                maxLength={80}
                placeholder="Custom category name"
                className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Stage
            </span>
            <select
              value={customStage}
              onChange={(e) => setCustomStage(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {CUSTOM_MATCH_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Format
            </span>
            <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
              {MAX_POINTS_OPTIONS.map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setCustomMaxPoints(pts)}
                  className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                    customMaxPoints === pts
                      ? 'bg-violet-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {pts} Points
                </button>
              ))}
            </div>
            <div className="flex items-center flex-wrap bg-slate-800 p-1 rounded-lg border border-slate-700 gap-0.5">
              {BEST_OF_OPTIONS.map((bo) => (
                <button
                  key={bo}
                  type="button"
                  onClick={() => setCustomBestOf(bo)}
                  className={`text-[10px] px-2.5 py-1 rounded font-bold ${
                    customBestOf === bo
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Best of {bo}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartCustomMatch}
            className="bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors shadow"
          >
            Start Custom Match ({customMaxPoints}p · BO{customBestOf})
          </button>
        </div>
        {customMatchError && (
          <p className="text-xs text-red-400" role="alert">
            {customMatchError}
          </p>
        )}
        {isCustomLiveMatch && (
          <p className="text-[11px] text-violet-300/90">
            Live now: {match.player1} vs {match.player2} · {match.category} · {match.stage}
          </p>
        )}
      </div>

    </div>
  );
};

export default AdminPanel;
