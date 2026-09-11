import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { db } from '../firebase';
import type { CommunityEvent, CommunityEventCategory } from '../data/communityEvents';
import { getEventStatus } from '../data/communityEvents';
import {
  addEventPost,
  removeEventPost,
  saveCommunityEvents,
  subscribeCommunityEvents
} from '../utils/communityEvents';
import { uploadGalleryMedia } from '../utils/galleryUploads';
import { GALLERY_DEFAULT_YEAR, galleryTagFromYear } from '../utils/matchGallery';
import { AdminNav } from '../components/AdminNav';

/**
 * Per-event admin configuration page. Sports events (Badminton/Tennis) get
 * quick links into the existing tournament admin tools — Tennis reuses the
 * exact same Score Desk / Results / Photos flow as Badminton, just with a
 * different sport selected there. Every event gets an "Updates" feed (image
 * and/or text posts) that shows on that event's public page.
 */
export default function AdminEventConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  useEffect(() => {
    const unsub = subscribeCommunityEvents(db, (list) => {
      setEvents(list);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const event = events.find((e) => e.id === id) ?? null;

  const persist = (next: CommunityEvent[]) => {
    setEvents(next);
    saveCommunityEvents(db, next).catch((err) => {
      console.error('Failed to save event:', err);
      setSaveMessage('Failed to save — check connection and try again.');
    });
  };

  const updateEvent = (patch: Partial<CommunityEvent>) => {
    if (!event) return;
    persist(events.map((e) => (e.id === event.id ? { ...e, ...patch } : e)));
  };

  const handleRemoveEvent = () => {
    if (!event) return;
    if (!window.confirm(`Remove "${event.title}"? This cannot be undone.`)) return;
    persist(events.filter((e) => e.id !== event.id));
    navigate('/admin/events');
  };

  const handlePost = async () => {
    if (!event) return;
    setPostError(null);
    if (!postText.trim() && !pendingImage) {
      setPostError('Add some text, an image, or both.');
      return;
    }
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (pendingImage) {
        const record = await uploadGalleryMedia(
          pendingImage,
          galleryTagFromYear(GALLERY_DEFAULT_YEAR),
          event.id
        );
        imageUrl = record.url;
      }
      await addEventPost(db, events, event.id, { text: postText, imageUrl });
      setPostText('');
      setPendingImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Could not post update.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!event) return;
    try {
      await removeEventPost(db, events, event.id, postId);
    } catch (err) {
      console.error('Failed to remove post:', err);
    }
  };

  if (loaded && !event) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-6 max-w-4xl mx-auto">
        <AdminNav subtitle="Event not found" />
        <Link to="/admin/events" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold">
          ← Back to Events
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const isSportsTournament = event.category === 'sports' && !!event.sport;
  const posts = Array.isArray(event.posts) ? event.posts : [];
  const isLocked = getEventStatus(event) === 'past';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-4xl mx-auto">
      <AdminNav subtitle={event.title} />

      <Link to="/admin/events" className="inline-block text-emerald-400 hover:text-emerald-300 text-sm font-semibold">
        ← Back to Events
      </Link>

      {saveMessage && (
        <p className="text-[11px] text-red-400" role="alert">
          {saveMessage}
        </p>
      )}

      {isLocked && (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          This event is completed — its details, image, and updates are locked. (Tournament admin
          tools below still work, for post-event corrections.)
        </p>
      )}

      {/* Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-indigo-300">Event Details</h1>
          <span
            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              getEventStatus(event) === 'ongoing'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            {getEventStatus(event)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Title</span>
            <input
              type="text"
              value={event.title}
              onChange={(e) => updateEvent({ title: e.target.value.slice(0, 80) })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Category</span>
            <select
              value={event.category}
              onChange={(e) => updateEvent({ category: e.target.value as CommunityEventCategory })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="sports">Sports</option>
              <option value="cultural">Cultural</option>
            </select>
          </label>

          {event.category === 'sports' && (
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                In-app tournament
              </span>
              <select
                value={event.sport ?? ''}
                onChange={(e) =>
                  updateEvent({
                    sport:
                      e.target.value === 'badminton' || e.target.value === 'tennis'
                        ? e.target.value
                        : undefined
                  })
                }
                disabled={isLocked}
                className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">None (not scored in-app)</option>
                <option value="badminton">Badminton</option>
                <option value="tennis">Tennis</option>
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Month (shift here as dates move)
            </span>
            <input
              type="text"
              value={event.month}
              onChange={(e) => updateEvent({ month: e.target.value.slice(0, 40) })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Date label (shown to viewers)
            </span>
            <input
              type="text"
              value={event.dateLabel}
              onChange={(e) => updateEvent({ dateLabel: e.target.value.slice(0, 80) })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Start date (optional — drives ongoing/next-up)
            </span>
            <input
              type="date"
              value={event.startDate ?? ''}
              onChange={(e) => updateEvent({ startDate: e.target.value || undefined })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">End date</span>
            <input
              type="date"
              value={event.endDate ?? ''}
              onChange={(e) => updateEvent({ endDate: e.target.value || undefined })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Location</span>
            <input
              type="text"
              value={event.location ?? ''}
              onChange={(e) => updateEvent({ location: e.target.value.slice(0, 80) })}
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1 md:col-span-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Poster image path (under /public)
            </span>
            <input
              type="text"
              value={event.imageSrc ?? ''}
              onChange={(e) => updateEvent({ imageSrc: e.target.value.slice(0, 200) || undefined })}
              placeholder="/events/example.jpg"
              disabled={isLocked}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</span>
          <textarea
            value={event.description ?? ''}
            onChange={(e) => updateEvent({ description: e.target.value.slice(0, 400) })}
            rows={2}
            disabled={isLocked}
            className="w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {!isLocked && (
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleRemoveEvent}
              className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
            >
              Remove this event
            </button>
          </div>
        )}
      </div>

      {/* Tournament admin (sports only) */}
      {isSportsTournament ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h2 className="text-lg font-bold text-violet-300">Tournament Admin</h2>
          <p className="text-xs text-slate-400">
            {event.sport === 'tennis'
              ? 'Tennis uses the exact same tools as Badminton — just pick Tennis when starting a match.'
              : 'Start matches, score them, and manage results from the tools below.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin"
              className="rounded-lg bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide px-3.5 py-2 hover:bg-amber-300"
            >
              Start / Fixtures
            </Link>
            <Link
              to="/admin/score"
              className="rounded-lg border border-slate-700 bg-slate-800 text-slate-100 font-bold text-xs uppercase tracking-wide px-3.5 py-2 hover:bg-slate-700"
            >
              Score Desk
            </Link>
            <Link
              to="/admin/results"
              className="rounded-lg border border-slate-700 bg-slate-800 text-slate-100 font-bold text-xs uppercase tracking-wide px-3.5 py-2 hover:bg-slate-700"
            >
              Results
            </Link>
            {event.sport === 'badminton' && (
              <Link
                to="/admin/teams"
                className="rounded-lg border border-slate-700 bg-slate-800 text-slate-100 font-bold text-xs uppercase tracking-wide px-3.5 py-2 hover:bg-slate-700"
              >
                Teams
              </Link>
            )}
            <Link
              to={`/photos?event=${event.id}`}
              className="rounded-lg border border-slate-700 bg-slate-800 text-slate-100 font-bold text-xs uppercase tracking-wide px-3.5 py-2 hover:bg-slate-700"
            >
              Photos
            </Link>
          </div>
        </div>
      ) : null}

      {/* Updates feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-amber-300">Updates</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isLocked
              ? 'This event is completed — posting is locked. Existing updates stay visible below.'
              : "Post an image, text, or both — it shows immediately on this event's public page."}
          </p>
        </div>

        {!isLocked && (
          <div className="space-y-2">
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={3}
              placeholder="What's the update?"
              className="w-full bg-slate-900/90 border border-amber-700/50 text-slate-100 text-sm px-2.5 py-2 rounded focus:outline-none focus:border-amber-500"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setPendingImage(e.target.files?.[0] ?? null)}
                className="text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-slate-200"
              />
              <button
                type="button"
                onClick={() => void handlePost()}
                disabled={posting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wide px-4 py-2 hover:bg-emerald-400 disabled:opacity-50"
              >
                {posting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
            {postError && (
              <p className="text-[11px] text-amber-300" role="alert">
                {postError}
              </p>
            )}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No updates posted yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex gap-3"
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg shrink-0"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  {post.text ? <p className="text-sm text-slate-200 whitespace-pre-line">{post.text}</p> : null}
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => void handleDeletePost(post.id)}
                    className="shrink-0 text-red-400 hover:text-red-300"
                    aria-label="Delete update"
                    title="Delete update"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
