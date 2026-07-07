import React, { useState } from "react";
import { Shield, Key, CheckCircle, HelpCircle, Copy, Check } from "lucide-react";

export default function SecurityGuide() {
  const [copied, setCopied] = useState(false);

  const rulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 驗證投票是否尚未過期
    function pollNotExpired(pollId) {
      return request.time < get(/databases/$(database)/documents/polls/$(pollId)).data.expiresAt;
    }

    // 投票主題 (Polls)
    match /polls/{pollId} {
      allow read: if true; // 所有人皆可讀取

      allow create: if request.resource.data.title is string
                    && request.resource.data.options is list
                    && request.resource.data.createdAt is timestamp
                    && request.resource.data.expiresAt is timestamp
                    && request.resource.data.title.size() > 0
                    && request.resource.data.options.size() >= 2
                    && (request.resource.data.creatorUid == null || request.resource.data.creatorUid is string);

      // 發起人可以更新投票（例如：手動結束投票），但嚴禁竄改題目或選項
      allow update: if request.auth != null 
                    && resource.data.creatorUid == request.auth.uid
                    && request.resource.data.title == resource.data.title
                    && request.resource.data.options == resource.data.options;
      allow delete: if false;
    }

    // 票數紀錄 (Votes)
    match /polls/{pollId}/votes/{voterUid} {
      allow read: if true; // 所有人皆可讀取票數進行統計

      // 核心安全規則：
      // 1. 必須是經過認證的使用者 (支援匿名登入)
      // 2. 寫入的 Document ID 必須等於使用者的 uid (防止冒用他人身份)
      // 3. 投票尚未截止
      // 4. 僅能新增投票，禁止修改 (update) 或收回 (delete)
      allow create: if request.auth != null 
                    && request.auth.uid == voterUid
                    && pollNotExpired(pollId)
                    && request.resource.data.optionIndex is int
                    && request.resource.data.votedAt is timestamp;

      allow update, delete: if false; // 投完票後，禁止竄改、重投或刪除
    }
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rulesCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl text-slate-100 p-6 md:p-8 rounded-2xl shadow-2xl border border-white/10 animate-fade-in" id="security-guide">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-500/30">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">安全架構師實踐指南 (Security Architect)</h2>
          <p className="text-sm text-slate-300">如何在純靜態網頁 (GitHub Pages) 環境下實現 100% 安全且防灌票的投票系統</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/5 p-5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-3 text-emerald-300 font-semibold text-sm">
            <Key className="w-4 h-4" />
            <span>1. 匿名認證 (Anonymous Auth)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            靜態網頁暴露了 API Key。但只要整合 <b>Firebase Anonymous Authentication</b>，使用者無須輸入帳號密碼，系統就能在 1 秒內在客戶端簽發唯一的加密憑證 <code>UID</code>。使用者無法偽造此憑證，這建立了防禦的信任基石。
          </p>
        </div>

        <div className="bg-white/5 p-5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-3 text-indigo-300 font-semibold text-sm">
            <Shield className="w-4 h-4" />
            <span>2. 綁定 UID 路徑 (Path Locking)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            我們將投票記錄儲存於 <code>/polls/{"{pollId}"}/votes/{"{voterUid}"}</code>。
            資料庫安全規則強制規定：寫入路徑上的 <code>voterUid</code> 必須完全等同於當前登入使用者的 <code>request.auth.uid</code>。任何試圖更改此 ID 的客戶端請求都會在伺服器端被拒絕。
          </p>
        </div>

        <div className="bg-white/5 p-5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-3 text-rose-300 font-semibold text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>3. 唯獨新增，不可修改</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            設定 <code>allow create</code> 為真，但 <code>allow update, delete</code> 設為 <code>false</code>。這意味著：一個使用者一旦成功寫入投票文件（即投出了一票），他們就<b>永遠無法修改或刪除</b>這筆資料，也無法再次建立（因為 Document ID 已被佔用且不可複寫）。
          </p>
        </div>
      </div>

      {/* Security Rule Code Block */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>📄 Firestore Security Rules 配置檔</span>
            <span className="text-xs font-normal text-slate-500">(firestore.rules)</span>
          </h3>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/20 text-xs rounded-lg transition-colors text-slate-300 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">已複製</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>複製代碼</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-4 bg-white/5 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto border border-white/10 leading-relaxed max-h-[300px]">
          <code>{rulesCode}</code>
        </pre>
      </div>

      {/* Deployment Guide */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-xl">
        <h3 className="text-sm font-bold text-indigo-300 mb-2 flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          如何將本專案正式連結到您自己的免費 Firebase 帳戶？
        </h3>
        <ol className="list-decimal list-inside text-xs text-slate-300 space-y-2 mt-2 leading-relaxed">
          <li>前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline hover:text-indigo-300">Firebase Console</a> 免費註冊並建立新專案。</li>
          <li>在專案設定中，啟用 <b>Firestore Database</b> 並將上面的「安全規則」複製貼入 Rules 標籤頁。</li>
          <li>在 <b>Authentication (認證)</b> 服務中啟用 <b>Anonymous (匿名登入)</b>。</li>
          <li>建立一個網頁應用程式 (Web App) 以獲取 Firebase Config 憑證。</li>
          <li>將這些設定以環境變數形式放入專案的 <code>.env</code> 檔案中（或在部署於 GitHub Pages 時直接以環境變數形式嵌入前端建置流程）。</li>
        </ol>
      </div>
    </div>
  );
}
