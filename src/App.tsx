import React, { useState, useEffect } from "react";
import { Shield, PlusCircle, HelpCircle } from "lucide-react";
import { getPollFromDB, isFirebaseConfigured } from "./lib/firebase";
import { Poll } from "./types";
import PollCreator from "./components/PollCreator";
import PollVoter from "./components/PollVoter";
import PollResults from "./components/PollResults";
import SecurityGuide from "./components/SecurityGuide";

type ViewState = 
  | { type: "CREATE" }
  | { type: "VOTE"; pollId: string; poll: Poll }
  | { type: "RESULTS"; pollId: string; poll: Poll }
  | { type: "GUIDE" };

export default function App() {
  const [view, setView] = useState<ViewState>({ type: "CREATE" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hash-based Routing Parser
  useEffect(() => {
    async function handleHashChange() {
      const hash = window.location.hash;
      setError(null);

      if (!hash || hash === "#/" || hash === "#" || hash === "#/create") {
        setView({ type: "CREATE" });
        return;
      }

      if (hash === "#/guide") {
        setView({ type: "GUIDE" });
        return;
      }

      // Check /poll/CODE
      const pollMatch = hash.match(/^#\/poll\/([a-zA-Z0-9_-]+)$/);
      if (pollMatch) {
        const id = pollMatch[1];
        setLoading(true);
        try {
          const poll = await getPollFromDB(id);
          if (poll) {
            setView({ type: "VOTE", pollId: id, poll });
          } else {
            setError(`找不到投票項目：${id}`);
            setView({ type: "CREATE" });
          }
        } catch (err) {
          setError("讀取投票資料時發生錯誤。");
          setView({ type: "CREATE" });
        } finally {
          setLoading(false);
        }
        return;
      }

      // Check /results/CODE
      const resultsMatch = hash.match(/^#\/results\/([a-zA-Z0-9_-]+)$/);
      if (resultsMatch) {
        const id = resultsMatch[1];
        setLoading(true);
        try {
          const poll = await getPollFromDB(id);
          if (poll) {
            setView({ type: "RESULTS", pollId: id, poll });
          } else {
            setError(`找不到投票統計項目：${id}`);
            setView({ type: "CREATE" });
          }
        } catch (err) {
          setError("讀取統計資料時發生錯誤。");
          setView({ type: "CREATE" });
        } finally {
          setLoading(false);
        }
        return;
      }

      // Fallback
      setView({ type: "CREATE" });
    }

    // Run on mount
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  const handlePollCreated = (pollId: string) => {
    navigateTo(`#/results/${pollId}`);
  };

  return (
    <div className="min-h-screen frosted-bg text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white" id="app-root">
      {/* Top Banner indicating Database Mode */}
      <div className={`w-full text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
        isFirebaseConfigured 
          ? "bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20" 
          : "bg-amber-500/10 text-amber-300 border-b border-amber-500/20"
      }`}>
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
        {isFirebaseConfigured ? (
          <span>🔌 已成功串接您的專屬 Firebase 即時資料庫</span>
        ) : (
          <span>💡 目前處於「瀏覽器沙盒模擬模式」。請點選上方安全指南查看如何連結正式 Firestore。</span>
        )}
      </div>

      {/* Main Responsive Header */}
      <header className="sticky top-0 z-40 bg-white/5 backdrop-blur-md border-b border-white/10 shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => navigateTo("#")}
            className="flex items-center gap-2.5 hover:opacity-90 active:opacity-100 transition-opacity cursor-pointer"
          >
            <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">SecureVote</span>
          </button>

          {/* Navigation links */}
          <nav className="flex items-center gap-1.5">
            <button
              onClick={() => navigateTo("#")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                view.type === "CREATE"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-md"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>發起投票</span>
            </button>

            <button
              onClick={() => navigateTo("#/guide")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                view.type === "GUIDE"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-md"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>安全指南</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-10">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-2xl font-medium shadow-lg">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="animate-spin h-8 w-8 text-indigo-400 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-semibold">正在同步雲端資料庫...</p>
          </div>
        ) : (
          /* Render Active Page view */
          <div>
            {view.type === "CREATE" && (
              <PollCreator onPollCreated={handlePollCreated} />
            )}

            {view.type === "VOTE" && (
              <PollVoter
                poll={view.poll}
                onVoteCast={() => navigateTo(`#/results/${view.pollId}`)}
                onViewResults={() => navigateTo(`#/results/${view.pollId}`)}
              />
            )}

            {view.type === "RESULTS" && (
              <PollResults
                poll={view.poll}
                onBackToVote={() => navigateTo(`#/poll/${view.pollId}`)}
                onGoHome={() => navigateTo("#")}
              />
            )}

            {view.type === "GUIDE" && (
              <SecurityGuide />
            )}
          </div>
        )}
      </main>

      {/* Styled Footer */}
      <footer className="bg-white/5 backdrop-blur-md border-t border-white/10 py-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-200">SecureVote Engine v1.0</span>
          </div>
          <div className="text-center md:text-right text-slate-400">
            基於 100% 伺服器端匿名憑證與安全規則，保證 GitHub Pages 靜態網站不被灌票。
          </div>
        </div>
      </footer>
    </div>
  );
}
