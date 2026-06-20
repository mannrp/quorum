"use client";
import { ReactNode, useState, useEffect, useRef } from "react";

export function Section({ title, children, className = "", variant = "wide" }: { title: string; children: ReactNode; className?: string; variant?: "tall" | "wide" }) {
  const panelClass = variant === "tall" ? "panel-tall" : "panel-wide";
  return (
    <section className={`${panelClass} space-y-4 transition-all ${className}`}>
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <h2 className="text-sm font-semibold text-[var(--text-app)]">{title}</h2>
        <span className="h-2 w-2 rounded-full bg-[var(--action-app)]" />
      </div>
      <div className="space-y-3 text-stone-700 dark:text-stone-300 font-normal leading-relaxed text-sm">{children}</div>
    </section>
  );
}

export function Status({ value }: { value: string }) {
  const getStyle = (val: string) => {
    switch (val.toUpperCase()) {
      case "OPEN":
      case "PENDING":
      case "RECRUITING":
        return "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info)]";
      case "CLAIMED":
      case "ACCEPTED":
      case "COMPLETE":
      case "MATCHED":
      case "PROFESSOR_APPROVED":
        return "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]";
      case "REJECTED":
      case "CLOSED":
      case "ARCHIVED":
      case "EXPIRED":
      case "CHANGES_REQUESTED":
        return "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]";
      case "UNVERIFIED":
      case "SUBMITTED_FOR_APPROVAL":
        return "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]";
      default:
        return "bg-[var(--bg-app)] text-[var(--text-app)] border-[var(--border-app)]";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold border ${getStyle(value)}`}>
      {value}
    </span>
  );
}

export function Badge({ label, type = "tag" }: { label: string; type?: "discipline" | "tag" | "lead" }) {
  const styles = {
    discipline: "bg-[var(--surface-app)] text-[var(--text-app)] border-[var(--border-app)] font-mono font-bold uppercase tracking-wider text-[9px]",
    tag: "bg-[var(--bg-app)] text-[var(--text-app)] border-[var(--border-subtle)] font-mono font-semibold text-[9px]",
    lead: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)] font-mono font-bold uppercase tracking-wider text-[9px]",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 border ${styles[type]}`}>
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
      <span className={`transition-all duration-150 ${done ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
        {label}
      </span>
      {done && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold uppercase text-[var(--color-success)] animate-pulse">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-xl bg-[var(--surface-app)] border border-[var(--border-app)] rounded-none shadow-none overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-app)] bg-[var(--bg-app)]">
          <h3 className="font-serif text-base font-bold uppercase tracking-tight text-[var(--text-app)]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-none hover:bg-[var(--bg-app)] text-[var(--text-app)] transition" aria-label="Close modal">
            <span className="text-xl font-mono leading-none">&times;</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 text-stone-700 dark:text-stone-300">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  disabled = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  disabled?: boolean;
}) {
  const confirmClass = variant === "danger"
    ? "btn-secondary py-2 px-4 text-xs text-rose-500 border-rose-300 dark:border-rose-900"
    : "btn-primary py-2 px-4 text-xs";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm leading-relaxed text-[var(--text-app)]">
          {message}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-app)] pt-4">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-xs" disabled={disabled}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={confirmClass} disabled={disabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Reusable Searchable Combobox Component for Tag Selection
export function Combobox({
  options,
  selected,
  onChange,
  placeholder = "Search and select tags...",
  maxItems = 3,
  allowCustom = true,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  allowCustom?: boolean;
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
  const trimmedQuery = query.trim();
  const canAddCustom = allowCustom &&
    trimmedQuery !== "" &&
    !selected.some((item) => item.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !options.some((item) => item.toLowerCase() === trimmedQuery.toLowerCase());

  const handleSelect = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((i) => i !== item));
    } else {
      onChange([...selected, item]);
    }
    setQuery("");
  };

  const handleAddCustom = () => {
    if (!canAddCustom) return;
    onChange([...selected, trimmedQuery]);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap gap-1.5 p-2 border border-[var(--border-app)] bg-[var(--surface-app)] rounded-none min-h-11">
        {selected.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-xs bg-[var(--bg-app)] text-[var(--text-app)] border border-[var(--border-subtle)] font-mono font-semibold">
            {item}
            <button type="button" onClick={() => handleSelect(item)} className="hover:text-[var(--accent-app)] font-bold transition font-mono">&times;</button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAddCustom) {
              e.preventDefault();
              handleAddCustom();
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-[var(--text-app)] placeholder-stone-400 dark:placeholder-stone-600 font-sans"
        />
      </div>

      {isOpen && (filtered.length > 0 || canAddCustom) && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-[var(--surface-app)] border border-[var(--border-app)] rounded-none divide-y divide-[var(--border-subtle)]">
          {canAddCustom && (
            <li>
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full px-4 py-2 text-left text-xs font-mono transition-colors flex items-center justify-between text-[var(--accent-app)] hover:bg-[var(--bg-app)] font-bold"
              >
                <span>Add &quot;{trimmedQuery}&quot;</span>
                <span>+</span>
              </button>
            </li>
          )}
          {filtered.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full px-4 py-2 text-left text-xs font-mono transition-colors flex items-center justify-between ${isSel ? "bg-[var(--bg-app)] text-[var(--accent-app)] font-bold" : "hover:bg-[var(--bg-app)] text-[var(--text-app)]"}`}
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
