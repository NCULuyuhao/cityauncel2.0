/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 AuthPage，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { login, register } from "../api/authApi";
import { saveAuthSession } from "../storage/authStorage";
import { canUseBrowserFullscreen, shouldUseCssImmersiveMode } from "../utils/displayMode";


type GroupMember = {
  id: number | string;
  username?: string;
  name?: string;
  email?: string;
  isGroupLeader?: boolean;
};

type AuthUser = {
  id: number;
  username: string;
  email: string;
  role?: "teacher" | "student";
  groupId?: string | null;
  groupName?: string | null;
  groupIcon?: string | null;
  isGroupLeader?: boolean;
  gender?: "male" | "female" | null;
  groupMembers?: GroupMember[];
};

type AuthPageProps = {
  onLoginSuccess: (token: string, user: AuthUser) => void;
};

function normalizeAuthUser(rawUser: unknown): AuthUser {
  const user = (rawUser && typeof rawUser === "object" ? rawUser : {}) as Partial<AuthUser> & Record<string, unknown>;
  return {
    id: Number(user?.id),
    username: String(user?.username || ""),
    email: String(user?.email || ""),
    role: user?.role === "teacher" ? "teacher" : "student",
    groupId: user?.groupId ?? null,
    groupName: user?.groupName ?? null,
    groupIcon: user?.groupIcon ?? null,
    isGroupLeader: Boolean(user?.isGroupLeader),
    gender: user?.gender === "male" || user?.gender === "female" ? user.gender : null,
    groupMembers: Array.isArray(user?.groupMembers) ? user.groupMembers : [],
  };
}

export default function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const shouldUseCssImmersive = shouldUseCssImmersiveMode();
  const canUseFullscreen = shouldUseCssImmersive || canUseBrowserFullscreen();

  useEffect(() => {
    if (typeof document === "undefined" || shouldUseCssImmersive) return;
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [shouldUseCssImmersive]);

  async function toggleFullscreen() {
    if (!canUseFullscreen) return;

    if (shouldUseCssImmersive) {
      setIsFullscreen((current) => !current);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("無法切換全螢幕模式：", error);
      setMessage("瀏覽器目前無法切換全螢幕，請再試一次");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedAccount = account.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (mode === "login" && (!trimmedAccount || !trimmedPassword)) {
      setMessage("請輸入帳號與密碼");
      return;
    }

    if (mode === "register" && (!trimmedUsername || !trimmedPassword || !gender)) {
      setMessage("請填寫完整資料，並選擇性別");
      return;
    }

    setMessage("");
    setIsSubmitting(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      const data = mode === "login"
        ? await login<AuthUser>({ account: trimmedAccount, password: trimmedPassword }, controller.signal)
        : await register<AuthUser>({ username: trimmedUsername, password: trimmedPassword, gender: gender as "male" | "female" }, controller.signal);

      if (mode === "register") {
        setMessage("註冊成功，請登入");
        setMode("login");
        setPassword("");
        setGender("");
        return;
      }

      if (!data.token || !data.user) {
        setMessage("登入回傳資料不完整，請重新登入");
        return;
      }

      const nextUser = normalizeAuthUser(data.user);
      saveAuthSession(data.token, nextUser);

      setIsSubmitting(false);
      onLoginSuccess(data.token, nextUser);
    } catch (error: unknown) {
      console.error(error);
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "登入逾時，請確認後端伺服器與資料庫是否正常"
          : error instanceof Error
            ? error.message
            : "無法連線到伺服器，請確認後端網址設定"
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`${shouldUseCssImmersive && isFullscreen ? "app-css-immersive-mode " : ""}game-auth-shell uiux-page-shell flex items-center justify-center p-4 sm:p-6`}>
      <div className="game-floating-compass hidden sm:block" />
      <div className="game-leopard-token hidden md:grid" />

      <section className="game-shell-card relative z-10 w-full max-w-5xl overflow-hidden rounded-[36px] p-4 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#6f8b58]/20 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#b8c6a7] via-[#ead9a6] to-[#d7a598]" />
        </div>

        <div className="game-auth-content-grid relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
          <div className="game-auth-hero flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[30px] border-[3px] border-[#8b765f]/35 bg-gradient-to-br from-[#d8dfc5] via-[#eef0d7] to-[#f3dfb8] p-5 text-[#2e2118] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:min-h-[520px] sm:p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#8b765f]/35 bg-[#fffaf0]/86 px-4 py-2 text-xs font-black tracking-[0.22em] shadow-[0_4px_0_rgba(74,46,27,0.16)]">
                🐾 STONE LEOPARD QUEST
              </div>

              <h1 className="game-title-text game-major-title mt-8 max-w-xl text-[clamp(2.7rem,8vw,5.7rem)] font-black leading-[0.98] tracking-[0.08em]">
                淺山<br />守望者
              </h1>

              <p className="mt-5 max-w-lg rounded-[24px] border-2 border-[#9a8266]/28 bg-[#fffaf0]/78 p-4 text-base font-black leading-8 shadow-[0_5px_0_rgba(74,46,27,0.13)]">
                化身小偵探，調查與解鎖數據卡、完成調查書、繪製任務地圖，找出淺山危機背後的線索。
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: "🃏", label: "收集線索卡" },
                { icon: "🗺️", label: "完成任務地圖" },
                { icon: "🎖️", label: "解鎖調查稱號" },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border-2 border-[#9a8266]/28 bg-[#fffaf0]/82 p-4 text-center shadow-[0_5px_0_rgba(74,46,27,0.14)]">
                  <div className="text-3xl">{item.icon}</div>
                  <div className="mt-2 text-sm font-black tracking-[0.08em]">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="game-auth-panel game-panel relative rounded-[30px] p-5 sm:p-7">
            <div className="mb-6 text-center">
              {canUseFullscreen ? (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="mb-4 inline-flex items-center justify-center rounded-[18px] border-2 border-[#8b7357] bg-[#fffdf4]/92 px-4 py-2 text-sm font-black tracking-[0.08em] text-[#4f3d2c] shadow-[0_4px_0_rgba(79,61,44,0.14)] transition active:translate-y-[1px]"
                >
                  {isFullscreen ? "關閉沉浸式體驗" : "點擊此處獲得沉浸式的體驗"}
                </button>
              ) : null}
              <p className="text-xs font-black tracking-[0.28em] text-[#7a4f2a]">
                {mode === "login" ? "RETURN TO BASE" : "NEW DETECTIVE"}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[0.08em] text-[#2e2118] sm:text-4xl">
                {mode === "login" ? "登入冒險基地" : "建立偵探檔案"}
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-[#6d533c]">
                {mode === "login" ? "輸入帳號後回到你的探究任務。" : "建立角色後就能開始淺山任務。"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  className="space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {mode === "register" ? (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-sm font-black tracking-[0.12em] text-[#4a2e1b]">偵探名稱</span>
                        <input className="game-input w-full px-4 py-3 font-bold outline-none" placeholder="使用者名稱" value={username} onChange={(e) => setUsername(e.target.value)} />
                      </label>
                      <div className="grid gap-2">
                        <p className="text-sm font-black tracking-[0.12em] text-[#4a2e1b]">角色資料</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value: "male", label: "生理男", icon: "🧢" },
                            { value: "female", label: "生理女", icon: "🎒" },
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setGender(item.value as "male" | "female")}
                              className={`rounded-[20px] border-2 px-4 py-3 text-sm font-black shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 ${
                                item.value === "male"
                                  ? gender === item.value
                                    ? "border-[#4d7897] bg-[#dceffc] text-[#234a63] shadow-[0_5px_0_rgba(77,120,151,0.20)]"
                                    : "border-[#b7d4e5] bg-[#f2f8fc] text-[#406176]"
                                  : gender === item.value
                                    ? "border-[#c87082] bg-[#ffe5eb] text-[#7f3043] shadow-[0_5px_0_rgba(200,112,130,0.20)]"
                                    : "border-[#ecc0c9] bg-[#fff5f7] text-[#7a4b56]"
                              }`}
                            >
                              <span className="mr-2">{item.icon}</span>{item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <label className="block">
                      <span className="mb-2 block text-sm font-black tracking-[0.12em] text-[#4a2e1b]">輸入帳號</span>
                      <input className="game-input w-full px-4 py-3 font-bold outline-none" placeholder="輸入你的偵探帳號" value={account} onChange={(e) => setAccount(e.target.value)} />
                    </label>
                  )}
                </motion.div>
              </AnimatePresence>

              <label className="block">
                <span className="mb-2 block text-sm font-black tracking-[0.12em] text-[#4a2e1b]">任務密碼</span>
                <input className="game-input w-full px-4 py-3 font-bold outline-none" placeholder="密碼" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>

              {message && <p className="rounded-[18px] border-2 border-red-200 bg-red-50 px-4 py-3 text-center font-black text-red-700">{message}</p>}

              <button type="submit" disabled={isSubmitting} className="game-primary-button w-full rounded-[22px] px-5 py-4 text-lg font-black tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? "任務處理中..." : mode === "login" ? "進入冒險" : "建立角色"}
              </button>
            </form>

            <button type="button" onClick={() => { if (isSubmitting) return; setMessage(""); setGender(""); setMode(mode === "login" ? "register" : "login"); }} className="mt-5 w-full rounded-[20px] border-2 border-[#4a2e1b]/35 bg-[#fff8df]/70 px-4 py-3 font-black text-[#5d3c23] underline-offset-4 hover:underline">
              {mode === "login" ? "還沒有角色？建立偵探檔案" : "已有角色？返回冒險基地"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}