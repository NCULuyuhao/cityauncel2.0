import { useEffect, useState, type ReactNode } from "react";

const INTRO_COUNTDOWN_SECONDS = 3;

function useIntroCountdown(resetKey: string) {
  const [secondsLeft, setSecondsLeft] = useState(INTRO_COUNTDOWN_SECONDS);

  useEffect(() => {
    const resetTimerId = window.setTimeout(() => {
      setSecondsLeft(INTRO_COUNTDOWN_SECONDS);
    }, 0);

    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearTimeout(resetTimerId);
      window.clearInterval(timerId);
    };
  }, [resetKey]);

  return secondsLeft;
}

export function IntroCountdownButton({
  resetKey,
  onClick,
  className,
  children,
}: {
  resetKey: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  const secondsLeft = useIntroCountdown(resetKey);
  const isLocked = secondsLeft > 0;

  return (
    <button
      type="button"
      onClick={() => {
        if (isLocked) return;
        onClick();
      }}
      disabled={isLocked}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-55`}
    >
      {isLocked ? (
        <span className="inline-flex items-center justify-center gap-1">
          <span>{children}</span>
          <span className="rounded-full bg-white/55 px-2 py-0.5 text-xs">
            {secondsLeft}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
