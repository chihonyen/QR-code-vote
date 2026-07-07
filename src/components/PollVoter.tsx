import React, { useState, useEffect } from "react";
import { Vote as VoteType, Poll } from "../types";
import { getAnonymousUser, castVoteInDB, getVotesFromDB, closePollInDB, getPollFromDB } from "../lib/firebase";
import { Check, ShieldAlert, Clock, CheckCircle2, UserCheck, BarChart3, AlertTriangle } from "lucide-react";

interface PollVoterProps {
  poll: Poll;
  onVoteCast: () => void;
  onViewResults: () => void;
}

export default function PollVoter({ poll, onVoteCast, onViewResults }: PollVoterProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [voterUid, setVoterUid] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [previousVoteIdx, setPreviousVoteIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [casting, setCasting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isCreator, setIsCreator] = useState(false);

  const isExpired = Date.now() > poll.expiresAt;

  // Auto-redirect to results if the poll has already expired
  useEffect(() => {
    if (isExpired && !loading) {
      onViewResults();
    }
  }, [isExpired, loading, onViewResults]);

  // Poll the database to detect if the creator ended the poll early
  useEffect(() => {
    let active = true;
    const checkPollStatus = async () => {
      try {
        const latestPoll = await getPollFromDB(poll.id);
        if (latestPoll && active) {
          if (latestPoll.expiresAt <= Date.now()) {
            onViewResults();
          }
        }
      } catch (err) {
        console.error("Error polling poll status:", err);
      }
    };

    // Check every 3 seconds for fast dynamic responsiveness
    const intervalId = setInterval(checkPollStatus, 3000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [poll.id, onViewResults]);

  // Initialize Anonymous authentication and check if already voted
  useEffect(() => {
    async function initAuthAndCheckVote() {
      try {
        setLoading(true);
        const user = await getAnonymousUser();
        setVoterUid(user.uid);

        if (poll.creatorUid && poll.creatorUid === user.uid) {
          setIsCreator(true);
        }

        // Fetch votes to see if this user has already cast a vote
        const votesList = await getVotesFromDB(poll.id);
        const userVote = votesList.find((v) => v.voterUid === user.uid);
        if (userVote) {
          setHasVoted(true);
          setPreviousVoteIdx(userVote.optionIndex);
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError("Unable to initialize anonymous authentication. Secure Poll ID applied.");
      } finally {
        setLoading(false);
      }
    }
    initAuthAndCheckVote();
  }, [poll.id, poll.creatorUid]);

  // Expiration countdown
  useEffect(() => {
    function updateCountdown() {
      const diff = poll.expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeftStr("Closed");
        onViewResults();
        return;
      }

      // If the poll has an extremely long duration (effectively indefinite/no set end time)
      if (poll.expiresAt - poll.createdAt > 30 * 24 * 60 * 60 * 1000) {
        setTimeLeftStr("Ongoing");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeftStr(`${days}d ${hours % 24}h left`);
      } else if (hours > 0) {
        setTimeLeftStr(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeftStr(`${minutes}m ${seconds}s left`);
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [poll.expiresAt, poll.createdAt]);

  const handleClosePoll = async () => {
    if (!window.confirm("Are you sure you want to end this poll now? Once ended, no one (including yourself) will be able to vote.")) {
      return;
    }
    setIsClosing(true);
    setError(null);
    try {
      await closePollInDB(poll.id);
      poll.expiresAt = Date.now() - 1000; // react immediately
      onViewResults();
    } catch (err: any) {
      setError(err.message || "An error occurred while ending the poll.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleCastVote = async () => {
    if (selectedIdx === null || !voterUid) return;
    setCasting(true);
    setError(null);

    try {
      await castVoteInDB(poll.id, voterUid, selectedIdx);
      setHasVoted(true);
      setPreviousVoteIdx(selectedIdx);
      onVoteCast();
    } catch (err: any) {
      setError(err.message || "Failed to submit vote. Please try again.");
    } finally {
      setCasting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <svg className="animate-spin h-8 w-8 text-indigo-400 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm font-semibold text-slate-300">Loading secure encrypted channel...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden" id="poll-voter">
      {/* Header Banner */}
      <div className={`p-6 text-white relative border-b ${isExpired ? "border-white/10 bg-white/5" : hasVoted ? "border-emerald-500/20 bg-emerald-500/10" : "border-indigo-500/20 bg-indigo-500/10"}`}>
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/10 backdrop-blur-xl border border-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeftStr}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-white/10 border border-white/10 rounded-md">
            ID: {poll.id}
          </span>
          {isExpired ? (
            <span className="text-[10px] bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md font-bold">Closed</span>
          ) : hasVoted ? (
            <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> Voted
            </span>
          ) : (
            <span className="text-[10px] bg-sky-500/20 border border-sky-500/30 text-sky-300 px-2 py-0.5 rounded-md font-bold animate-pulse">Voting in Progress</span>
          )}
        </div>

        <h2 className="text-xl font-extrabold tracking-tight break-words mb-2">{poll.title}</h2>
        {poll.description && (
          <p className="text-xs text-slate-300 font-medium break-words leading-relaxed">{poll.description}</p>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6 md:p-8 space-y-6">
        {isCreator && !isExpired && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-300 font-bold">You are the poll creator</span>
              </div>
              <p className="text-[10px] text-slate-400">You can close this poll at any time to prevent further voting.</p>
            </div>
            <button
              onClick={handleClosePoll}
              disabled={isClosing}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:scale-100 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-amber-500/10 flex-shrink-0"
            >
              {isClosing ? "Closing..." : "Close Poll"}
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 text-rose-300 text-xs rounded-xl border border-rose-500/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {hasVoted ? (
          /* Voted Success State */
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">投票成功送達！</h3>
              <p className="text-xs text-slate-400 mt-1">您已使用加密設備特徵簽署本次投票，數據已即時鎖定並同步至雲端。</p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left space-y-2">
              <div className="text-[10px] text-slate-400 font-mono">您的選擇：</div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center text-sm font-semibold text-white">
                <span>{poll.options[previousVoteIdx ?? 0]}</span>
                <span className="text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {previousVoteIdx !== null ? `第 ${previousVoteIdx + 1} 項` : ""}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onViewResults}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25"
              >
                <BarChart3 className="w-4 h-4" />
                <span>查看統計數據</span>
              </button>
            </div>
          </div>
        ) : isExpired ? (
          /* Expired State */
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-14 h-14 bg-white/10 text-slate-400 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">本場投票已截止</h3>
              <p className="text-xs text-slate-400 mt-1">此項目已於期限屆滿後自動關閉，無法再接收新的投票紀錄。</p>
            </div>

            <div className="space-y-2 text-left">
              {poll.options.map((opt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs font-semibold flex justify-between items-center"
                >
                  <span>{opt}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onViewResults}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25"
            >
              <BarChart3 className="w-4 h-4" />
              <span>觀看投票統計結果</span>
            </button>
          </div>
        ) : (
          /* Interactive Voting List */
          <div className="space-y-4">
            <div className="text-[10px] text-indigo-300 font-bold tracking-wider uppercase mb-1">請選擇您的選項</div>
            <div className="space-y-2.5">
              {poll.options.map((opt, idx) => {
                const isSelected = selectedIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full p-4 rounded-xl border text-left text-sm font-semibold transition-all flex justify-between items-center relative overflow-hidden cursor-pointer ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-500/20 text-white shadow-lg"
                        : "border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:border-white/20"
                    }`}
                  >
                    <span className="relative z-10 truncate pr-4">{opt}</span>
                    <div
                      className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors relative z-10 ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-white/20 bg-white/5"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Form Actions */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <button
                onClick={handleCastVote}
                disabled={selectedIdx === null || casting}
                className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-white/5 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {casting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>正在進行加密簽章並寫入...</span>
                  </>
                ) : (
                  <>
                    <span>送出我的投票 (只限一次)</span>
                  </>
                )}
              </button>

              <button
                onClick={onViewResults}
                className="w-full py-2.5 text-xs text-slate-300 font-semibold hover:text-indigo-300 transition-colors bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer"
              >
                不投票，直接看即時統計
              </button>
            </div>
          </div>
        )}

        {/* Security Footnote */}
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-center gap-2.5 text-[10px] text-slate-300">
          <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>We use anonymous tokens to protect your privacy. Your choices are fully encrypted and anonymous in the database.</span>
        </div>
      </div>
    </div>
  );
}
