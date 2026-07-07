import React, { useState, useEffect } from "react";
import { Plus, Trash, Sparkles, ChevronRight, BarChart3, Vote } from "lucide-react";
import { createPollInDB, getAnonymousUser, getPollFromDB } from "../lib/firebase";

interface PollCreatorProps {
  onPollCreated: (pollId: string) => void;
}

export default function PollCreator({ onPollCreated }: PollCreatorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPolls, setCreatedPolls] = useState<{ id: string; title: string }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteRecord = (idToDelete: string) => {
    const updatedPolls = createdPolls.filter(p => p.id !== idToDelete);
    setCreatedPolls(updatedPolls);

    const savedIds = localStorage.getItem("my_created_polls");
    if (savedIds) {
      try {
        const ids: string[] = JSON.parse(savedIds);
        const updatedIds = ids.filter(id => id !== idToDelete);
        localStorage.setItem("my_created_polls", JSON.stringify(updatedIds));
      } catch (e) {
        console.error("Error updating localStorage after deletion:", e);
      }
    }
  };

  // Load recently created polls from history
  useEffect(() => {
    async function loadCreatedPolls() {
      const savedIds = localStorage.getItem("my_created_polls");
      if (savedIds) {
        try {
          const ids: string[] = JSON.parse(savedIds);
          const list = [];
          // Fetch up to 5 recently created polls
          for (const id of ids.slice(0, 5)) {
            const p = await getPollFromDB(id);
            if (p) {
              list.push({ id, title: p.title });
            }
          }
          setCreatedPolls(list);
        } catch (e) {
          console.error("Error loading created polls:", e);
        }
      }
    }
    loadCreatedPolls();
  }, []);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    setOptions(newOptions);
  };

  const handleLoadExample = (num: number) => {
    if (num === 1) {
      setTitle("中午吃什麼？");
      setDescription("大家一起投票決定今天的午餐吧！");
      setOptions(["精緻日式拉麵", "古早味排骨便當", "拿坡里窯烤披薩", "健康低卡沙拉盆"]);
    } else {
      setTitle("下季度員工聚餐去哪辦？");
      setDescription("請大家選出最期待的聚餐類型，福委會將根據投票結果進行預約。");
      setOptions(["頂級和牛燒肉吃到飽", "五星級飯店海鮮百匯", "米其林推薦台菜料理", "美式運動酒吧與手工漢堡"]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!title.trim()) {
      setError("請輸入投票題目");
      return;
    }

    const filteredOptions = options.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      setError("請至少填寫兩個有效投票選項");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await getAnonymousUser();
      // Poll is active indefinitely (e.g. 100 years) until manually closed by creator
      const expiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000; 
      
      const pollId = await createPollInDB({
        title: title.trim(),
        description: description.trim() || undefined,
        options: filteredOptions,
        expiresAt,
        creatorUid: user.uid
      });

      // Save to locally created polls history in localStorage
      const saved = localStorage.getItem("my_created_polls");
      const list = saved ? JSON.parse(saved) : [];
      if (!list.includes(pollId)) {
        localStorage.setItem("my_created_polls", JSON.stringify([pollId, ...list]));
      }

      onPollCreated(pollId);
    } catch (err: any) {
      setError(err.message || "建立投票時發生錯誤，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in" id="poll-creator">
      {/* Creation Card */}
      <div className="bg-white/5 backdrop-blur-xl text-white p-6 md:p-8 rounded-2xl shadow-2xl border border-white/10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center md:text-left">
            <h2 className="text-xl font-extrabold text-white leading-tight mb-1">🚀 快速投票</h2>
            <p className="text-xs text-slate-400">
              免註冊帳號！一鍵在雲端建立 100% 防灌票機制的安全投票。
            </p>
          </div>

          {/* Quick Examples Box */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>快速帶入示範例子：</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleLoadExample(1)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-200 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:border-indigo-400"
              >
                🍔 中午吃什麼？
              </button>
              <button
                type="button"
                onClick={() => handleLoadExample(2)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-200 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:border-indigo-400"
              >
                🎉 員工聚餐去哪辦？
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 text-rose-300 text-xs rounded-xl border border-rose-500/20 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">投票主題 <span className="text-rose-400">*</span></label>
            <input
              type="text"
              placeholder="請輸入投票題目..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm text-white placeholder-slate-500 font-medium"
              maxLength={150}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">補充說明 (選填)</label>
            <textarea
              placeholder="提供投票背景資訊、規則或注意事項..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm min-h-[70px] text-white placeholder-slate-500"
              maxLength={500}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-300">
                投票選項 <span className="text-slate-400">({options.length}/10)</span>
              </label>
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-xs text-indigo-400 font-semibold hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增選項</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {options.map((option, idx) => (
                <div key={idx} className="flex gap-2 items-center group">
                  <span className="text-xs font-mono text-slate-500 w-5 text-center">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`選項 ${idx + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm text-white placeholder-slate-500 font-medium"
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors duration-200 opacity-80 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.98] disabled:scale-100 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>正在串接雲端資料庫...</span>
              </>
            ) : (
              <>
                <span>建立安全投票並生成 QR Code</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* History section for ease of navigation */}
      {createdPolls.length > 0 && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>您最近建立的投票項目</span>
          </h3>
          <div className="divide-y divide-white/5">
            {createdPolls.map((poll) => (
              <div key={poll.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                <span className="text-xs font-medium text-slate-200 truncate">{poll.title}</span>
                {deletingId === poll.id ? (
                  <div className="flex gap-1.5 items-center shrink-0">
                    <span className="text-[10px] text-rose-400 font-bold mr-1">確定刪除此紀錄？</span>
                    <button
                      onClick={() => {
                        handleDeleteRecord(poll.id);
                        setDeletingId(null);
                      }}
                      className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 rounded text-[10px] font-extrabold transition-all cursor-pointer"
                    >
                      確定
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 rounded text-[10px] font-bold transition-all cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center shrink-0">
                    <a
                      href={`#/poll/${poll.id}`}
                      className="px-3 py-1.5 bg-white/5 hover:bg-indigo-500/10 border border-white/10 text-indigo-300 hover:text-indigo-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                    >
                      <Vote className="w-3.5 h-3.5" />
                      投票頁面
                    </a>
                    <a
                      href={`#/results/${poll.id}`}
                      className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      統計計票
                    </a>
                    <button
                      onClick={() => setDeletingId(poll.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg transition-all cursor-pointer"
                      title="刪除此項紀錄"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
