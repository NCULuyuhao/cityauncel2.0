import { forwardRef, type ReactNode } from "react";

export const TitleCollection = forwardRef<HTMLElement, { children: ReactNode }>(
  function TitleCollection({ children }, ref) {
    return (
      <section
        ref={ref}
        className="relative overflow-hidden rounded-[24px] border border-[#d8cbb3] bg-[#f7f1e6]/86 p-4 sm:rounded-[34px] sm:p-6 shadow-[0_22px_70px_rgba(45,41,34,0.11)] backdrop-blur-md"
      >
        {children}
      </section>
    );
  },
);
