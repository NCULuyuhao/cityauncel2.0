import { ArrowLeft } from "lucide-react";

type CardPackPageHeaderProps = {
  isOpened: boolean;
  packTitle: string;
  onBack: () => void;
};

export function CardPackPageHeader({
  isOpened,
  packTitle,
  onBack,
}: CardPackPageHeaderProps) {
  return (
    <div className="relative z-20 mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr] items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black tracking-[0.12em] text-black/85 backdrop-blur transition"
      >
        <ArrowLeft className="h-4 w-4" /> 回首頁
      </button>

      <h1 className="justify-self-center rounded-[28px] border border-white/28 bg-black/34 px-4 py-2 text-center font-serif text-2xl font-black tracking-[0.08em] text-white shadow-[0_10px_34px_rgba(0,0,0,0.32),0_0_28px_rgba(255,255,255,0.12)] backdrop-blur-sm sm:px-5 sm:py-3 sm:text-5xl lg:text-6xl">
        {isOpened ? packTitle : "角色卡包"}
      </h1>

      <div className="hidden w-[104px] sm:block" aria-hidden="true" />
    </div>
  );
}
