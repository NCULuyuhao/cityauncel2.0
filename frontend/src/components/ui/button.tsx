/**
 * CityAuncel maintainability notes
 * 檔案用途：共用基礎 UI 元件 button，提供一致的樣式與互動介面。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline";
};

export function Button({
  className = "",
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

  const variantClass =
    variant === "ghost"
      ? "bg-transparent text-white hover:bg-white/10"
      : variant === "outline"
      ? "border border-white/20 bg-transparent text-white hover:bg-white/10"
      : "";

  return (
    <button type={type} className={`${base} ${variantClass} ${className}`} {...props} />
  );
}