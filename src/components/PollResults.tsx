import React, { useState, useEffect, useRef } from "react";
import { Poll, Vote } from "../types";
import { getVotesFromDB, getAnonymousUser, closePollInDB } from "../lib/firebase";
import { BarChart3, RefreshCw, Share2, Copy, Check, ArrowLeft, Download } from "lucide-react";
import QRCode from "qrcode";

interface PollResultsProps {
  poll: Poll;
  onBackToVote: () => void;
  onGoHome: () => void;
}

export default function PollResults({ poll, onBackToVote, onGoHome }: PollResultsProps) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExpired, setIsExpired] = useState(Date.now() > poll.expiresAt);

  // Calculate Poll link based on window location
  const getPollUrl = () => {
    // We use hash routing: #/poll/ID
    const base = window.location.origin + window.location.pathname;
    return `${base}#/poll/${poll.id}`;
  };

  const pollUrl = getPollUrl();

  const fetchVotes = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const list = await getVotesFromDB(poll.id);
      setVotes(list);
    } catch (error) {
      console.error("Failed to load votes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial Fetch & QR Code generation
  useEffect(() => {
    fetchVotes();
    
    // Auto refresh every 10 seconds for active polls
    const interval = setInterval(() => {
      if (!isExpired) {
        fetchVotes(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [poll.id, isExpired]);

  // Check if current user is the creator of the poll
  useEffect(() => {
    async function checkCreator() {
      try {
        const user = await getAnonymousUser();
        if (poll.creatorUid && poll.creatorUid === user.uid) {
          setIsCreator(true);
        }
      } catch (err) {
        console.error("Check creator error:", err);
      }
    }
    checkCreator();
  }, [poll.creatorUid]);

  const handleClosePoll = async () => {
    if (!window.confirm("您確定要立刻結束此投票嗎？結束後所有人（包括您自己）都將無法再進行投票。")) {
      return;
    }
    setIsClosing(true);
    try {
      await closePollInDB(poll.id);
      setIsExpired(true);
      poll.expiresAt = Date.now() - 1000; // react locally immediately
      await fetchVotes(true); // Fetch final results immediately to display them
    } catch (err: any) {
      alert("結束投票失敗：" + (err.message || err));
    } finally {
      setIsClosing(false);
    }
  };

  // Generate QR Code on canvas
  useEffect(() => {
    if (qrCanvasRef.current && pollUrl) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        pollUrl,
        {
          width: 160,
          margin: 1.5,
          color: {
            dark: "#0f172a", // slate-900
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error("QR Code generation error:", error);
        }
      );
    }
  }, [pollUrl, loading]);

  // Calculations
  const totalVotes = votes.length;
  const optionCounts = poll.options.reduce((acc, _, idx) => {
    acc[idx] = votes.filter((v) => v.optionIndex === idx).length;
    return acc;
  }, {} as Record<number, number>);

  // Find the highest vote count to highlight the winner
  const maxVotes = Math.max(...Object.values(optionCounts), 0);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pollUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;
    const url = qrCanvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `poll-${poll.id}-qrcode.png`;
    link.href = url;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <svg className="animate-spin h-8 w-8 text-indigo-400 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm font-semibold text-slate-300">正在即時統計雲端選票...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in" id="poll-results">
      {/* Visual Chart Panel */}
      <div className="lg:col-span-3 bg-white/5 backdrop-blur-xl text-white p-6 md:p-8 rounded-2xl shadow-2xl border border-white/10 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex justify-between items-start border-b border-white/10 pb-4">
            <div>
              <div className="text-[10px] text-indigo-300 font-mono tracking-wider uppercase mb-0.5">即時統計計票板</div>
              <h2 className="text-xl font-extrabold text-white leading-tight">{poll.title}</h2>
              {poll.description && (
                <p className="text-xs text-slate-300 mt-1">{poll.description}</p>
              )}
            </div>
            <button
              onClick={() => fetchVotes(true)}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-white/5 rounded-lg transition-all flex items-center justify-center cursor-pointer"
              title="重新載入票數"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>

          {isCreator && !isExpired && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-300 font-bold">您是此投票發起人</span>
                </div>
                <p className="text-[10px] text-slate-400">目前為持續計票狀態。您可以隨時在此手動結束投票。</p>
              </div>
              <button
                onClick={handleClosePoll}
                disabled={isClosing}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/15 flex-shrink-0"
              >
                {isClosing ? "結束中..." : "立刻結束投票"}
              </button>
            </div>
          )}

          {isExpired && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse flex-shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs text-rose-300 font-bold">🔒 此投票已結束計票</span>
                <p className="text-[10px] text-slate-400">所有投票管道已關閉，結果已安全加密存檔。</p>
              </div>
            </div>
          )}

          {/* Stats Bar List */}
          <div className="space-y-3">
            {poll.options.map((opt, idx) => {
              const count = optionCounts[idx] || 0;
              const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isWinner = count > 0 && count === maxVotes;

              return (
                <div 
                  key={idx} 
                  className={`p-3.5 rounded-xl border transition-all duration-500 flex flex-col gap-2 ${
                    isWinner 
                      ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                      : "bg-white/5 border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-2 truncate max-w-[70%]">
                      <span className={`truncate ${isWinner ? "text-indigo-200 font-bold" : "text-slate-300"}`}>
                        {opt}
                      </span>
                      {isWinner && (
                        <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded font-bold flex items-center gap-0.5">
                          {isExpired ? "🏆 最終勝出" : "🔥 領先中"}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono">
                      <b className="text-white font-bold">{count} 票</b> ({percentage}%)
                    </span>
                  </div>

                  {/* Progressive Bar Container */}
                  <div className="h-4.5 bg-white/5 rounded-lg overflow-hidden border border-white/10 relative">
                    {/* Animated fill bar */}
                    <div
                      style={{ width: `${percentage}%`, transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
                      className={`h-full rounded-r-md transition-all duration-1000 ${
                        isWinner 
                          ? "bg-gradient-to-r from-indigo-500 to-cyan-500 shadow-md" 
                          : "bg-white/15"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Sum */}
          <div className="pt-4 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
            <span>本項目設有 Cloud 防灌票安全規則保護</span>
            <span className="font-mono text-slate-300">
              總票數：<b className="text-indigo-300 text-sm font-bold">{totalVotes}</b> 票
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-white/10">
          <button
            onClick={onBackToVote}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回投票畫面</span>
          </button>
          <button
            onClick={onGoHome}
            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            <span>發起新投票</span>
          </button>
        </div>
      </div>

      {/* Sharing Panel & QR Code */}
      <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl flex flex-col justify-between space-y-6 shadow-2xl">
        <div className="space-y-4 text-center sm:text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 border-b border-white/10 pb-3">
            <Share2 className="w-4 h-4 text-slate-400" />
            <span>分享此投票 (行動掃碼)</span>
          </div>

          <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-white/10 shadow-lg max-w-[200px] mx-auto">
            <canvas ref={qrCanvasRef} className="w-40 h-40" />
            <button
              onClick={handleDownloadQR}
              className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-500 font-semibold hover:text-indigo-600 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下載 QR Code 圖檔</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            手機掃描上方二維條碼即可快速投下您的選票。本畫面完美適配行動版裝置！
          </p>
        </div>

        {/* Link Copy Box */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">投票與計票網址</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={pollUrl}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-slate-300 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer ${
                copied
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-300"
              }`}
              title="複製連結"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
