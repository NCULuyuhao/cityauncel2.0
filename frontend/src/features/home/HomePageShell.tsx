import type { ReactNode } from "react";

export function PageLoadingFallback() {
  return (
    <div className="game-adventure-page flex min-h-[100svh] items-center justify-center p-6 text-center">
      <div className="rounded-[28px] border border-[#e7d8bd] bg-white/80 px-8 py-6 text-sm font-black text-[#6b5b46] shadow-[0_18px_45px_rgba(102,75,42,0.12)]">
        頁面載入中...
      </div>
    </div>
  );
}

export function PageTransitionFrame({ children }: { children: ReactNode }) {
  return <div className="page-transition-layer">{children}</div>;
}
