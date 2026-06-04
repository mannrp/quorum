"use client";
import { ReactNode, useState, useEffect, useRef } from "react";

export function Section({ title, children, className = "", variant = "wide" }: { title: string; children: ReactNode; className?: string; variant?: "tall" | "wide" }) {
  const panelClass = variant === "tall" ? "panel-tall" : "panel-wide";
  return (
    <section className={`${panelClass} space-y-4 transition-all ${className}`}>
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
        <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-[#283593] dark:text-[#a5b4fc]">{title}</h2>
        <div className="h-0.5 w-6 rounded bg-[#283593] dark:bg-[#a5b4fc]"></div>
      </div>
      <div className="space-y-4 text-stone-700 dark:text-stone-300 font-normal leading-relaxed text-sm">{children}</div>
    </section>
  );
}

export function Status({ value }: { value: string }) {
  const getStyle = (val: string) => {
    switch (val.toUpperCase()) {
      case "OPEN":
      case "PENDING":
      case "RECRUITING":
        return "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-350 border-indigo-200 dark:border-indigo-900";
      case "CLAIMED":
      case "ACCEPTED":
      case "COMPLETE":
      case "MATCHED":
      case "PROFESSOR_APPROVED":
        return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-350 border-emerald-250 dark:border-emerald-900";
      case "REJECTED":
      case "CLOSED":
      case "ARCHIVED":
      case "EXPIRED":
      case "CHANGES_REQUESTED":
        return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350 border-rose-200 dark:border-rose-900";
      case "UNVERIFIED":
      case "SUBMITTED_FOR_APPROVAL":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-350 border-amber-250 dark:border-amber-900";
      default:
        return "bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getStyle(value)}`}>
      {value}
    </span>
  );
}

export function Badge({ label, type = "tag" }: { label: string; type?: "discipline" | "tag" | "lead" }) {
  const styles = {
    discipline: "bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-250 border-stone-300 dark:border-stone-750 font-bold uppercase tracking-wider text-[10px]",
    tag: "bg-indigo-50/50 dark:bg-indigo-950/20 text-[#48626e] dark:text-slate-350 border-stone-250 dark:border-stone-800 font-semibold text-[10px]",
    lead: "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-350 border-amber-250 dark:border-amber-900 font-bold uppercase tracking-wider text-[10px]",
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
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
          Done
        </span>
      )}
    </button>
  );
}

// Reusable Modal Component
export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-white dark:bg-[#161a2b] border border-stone-200 dark:border-stone-850 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40">
          <h3 className="font-serif text-lg font-bold text-[#283593] dark:text-[#a5b4fc]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 transition" aria-label="Close modal">
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 text-stone-700 dark:text-stone-300">
          {children}
        </div>
      </div>
    </div>
  );
}

// Reusable Searchable Combobox Component for Tag Selection
export function Combobox({
  options,
  selected,
  onChange,
  placeholder = "Search and select tags...",
  maxItems = 3,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = query === ""
    ? options
    : options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((i) => i !== item));
    } else {
      onChange([...selected, item]);
    }
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap gap-1.5 p-2 border border-[#cbd5e1] dark:border-stone-850 bg-white dark:bg-[#111422] rounded-md shadow-sm min-h-11">
        {selected.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-350 border border-indigo-200 dark:border-indigo-900 font-semibold">
            {item}
            <button type="button" onClick={() => handleSelect(item)} className="hover:text-rose-500 font-bold transition">&times;</button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-[#191c1d] dark:text-slate-100"
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#161a2b] border border-stone-200 dark:border-stone-800 rounded-md shadow-lg divide-y divide-stone-100 dark:divide-stone-800">
          {filtered.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full px-4 py-2 text-left text-xs transition-colors flex items-center justify-between ${isSel ? "bg-[#f1f5f9] dark:bg-[#1e253c] text-indigo-700 dark:text-indigo-300 font-bold" : "hover:bg-[#f8f9fa] dark:hover:bg-[#1e253c]/40 text-stone-700 dark:text-stone-300"}`}
                >
                  <span>{opt}</span>
                  {isSel && <span>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
