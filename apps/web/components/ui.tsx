"use client";
import { ReactNode, useState } from "react";

export function Section({ title, children, className = "", variant = "wide" }: { title: string; children: ReactNode; className?: string; variant?: "tall" | "wide" }) {
  const panelClass = variant === "tall" ? "panel-tall" : "panel-wide";
  return (
    <section className={`${panelClass} space-y-4 bg-white dark:bg-stone-900 p-8 rounded-md transition-all ${className}`}>
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">{title}</h2>
        <div className="h-0.5 w-6 rounded bg-stone-900 dark:bg-stone-100"></div>
      </div>
      <div className="space-y-4 text-stone-850 dark:text-stone-250 font-normal leading-relaxed">{children}</div>
    </section>
  );
}

export function Status({ value }: { value: string }) {
  const getStyle = (val: string) => {
    switch (val.toUpperCase()) {
      case "OPEN":
      case "PENDING":
        return "bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700";
      case "CLAIMED":
      case "ACCEPTED":
      case "COMPLETE":
        return "bg-[#F1F5F0] dark:bg-[#1E2520] text-[#344237] dark:text-[#C5D3C3] border-[#A8BAA5] dark:border-[#384A3B]";
      case "REJECTED":
      case "CLOSED":
        return "bg-rose-100 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 border-rose-350 dark:border-rose-900";
      default:
        return "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700";
    }
  };

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getStyle(value)}`}>
      {value}
    </span>
  );
}

export function Badge({ label, type = "tag" }: { label: string; type?: "discipline" | "tag" | "lead" }) {
  const styles = {
    discipline: "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-750 font-bold uppercase tracking-wider text-[10px]",
    tag: "bg-[#F1F5F0] dark:bg-[#1E2520] text-[#344237] dark:text-[#C5D3C3] border-[#A8BAA5] dark:border-[#384A3B] font-semibold text-[10px]",
    lead: "bg-amber-100 dark:bg-amber-950/40 text-amber-950 dark:text-amber-300 border-amber-350 dark:border-amber-900 font-bold uppercase tracking-wider text-[10px]",
  };

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 border ${styles[type]}`}>
      {label}
    </span>
  );
}

export function ActionButton({ label, onClick, variant = "primary", className = "" }: { label: string; onClick?: () => void; variant?: "primary" | "secondary" | "accent"; className?: string }) {
  const [done, setDone] = useState(false);
  const btnClass = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-accent";

  const handleClick = () => {
    if (onClick) onClick();
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <button onClick={handleClick} className={`${btnClass} ${className} relative overflow-hidden`}>
      <span className={`transition-all duration-200 ${done ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
        {label}
      </span>
      {done && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-stone-900 dark:text-white animate-pulse">
          [-] Done
        </span>
      )}
    </button>
  );
}

