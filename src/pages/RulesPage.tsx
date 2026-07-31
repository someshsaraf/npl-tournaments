import { ArrowLeft, ShieldAlert, Award, Dices } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RulesPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-700 pb-4">
        <Link to="/live" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </Link>
        <h1 className="text-2xl font-bold text-amber-400">NPL 2026 Official Rules & Regulations</h1>
      </div>

      {/* General Rules */}
      <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
          <ShieldAlert className="w-5 h-5" /> General Rules & Guidelines
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm md:text-base">
          <li>Match referee's decision is final. Arguing with referee leads to penalties.</li>
          <li>All players must arrive at least 10 minutes prior to scheduled slot.</li>
          <li>Non-marking shoes are strictly required on court.</li>
          <li>Service contact point must be below 1.15m; spin serves are banned.</li>
        </ul>
      </section>

      {/* Team Championship */}
      <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
          <Award className="w-5 h-5" /> Team Championship & Trump Rules
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm md:text-base">
          <li>5 Teams, 5 players each. Each tie has 5 matches (1 Singles, 4 Ranked Doubles).</li>
          <li>Group Stage matches are a race to 15 points (no deuce at 14-14).</li>
          <li><strong className="text-amber-400">Trump Game:</strong> Winning a Trump game gives <strong>+2 points</strong>; losing gives <strong>-1 point</strong>.</li>
          <li>Each team must specify exactly 1 Trump Game per match tie.</li>
        </ul>
      </section>

      {/* Point Targets */}
      <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 text-pink-400">
          <Dices className="w-5 h-5" /> Category Formats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-sky-400">Kids & Women's Categories</h3>
            <p className="text-slate-400 mt-1">Race to 15 points. Deuce rules apply (lead by 2 points up to max 20).</p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
            <h3 className="font-semibold text-sky-400">Men's Categories</h3>
            <p className="text-slate-400 mt-1">Race to 21 points. Deuce rules apply (lead by 2 points up to max 30).</p>
          </div>
        </div>
      </section>
    </div>
  );
}
