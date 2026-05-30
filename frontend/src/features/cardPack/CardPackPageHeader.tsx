type CardPackPageHeaderProps = {
  isOpened: boolean;
  packTitle: string;
};

export function CardPackPageHeader({
  isOpened,
  packTitle,
}: CardPackPageHeaderProps) {
  return (
    <div className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-center">
      <h1 className="justify-self-center rounded-[28px] border border-white/28 bg-black/34 px-4 py-2 text-center font-serif text-2xl font-black tracking-[0.08em] text-white shadow-[0_10px_34px_rgba(0,0,0,0.32),0_0_28px_rgba(255,255,255,0.12)] backdrop-blur-sm sm:px-5 sm:py-3 sm:text-5xl lg:text-6xl">
        {isOpened ? packTitle : "角色卡包"}
      </h1>
    </div>
  );
}
