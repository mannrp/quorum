"use client";
import { useEffect, useState } from "react";

interface DeadlineDisplayProps {
  deadlineAt: string;
  label?: string;
  consequenceText?: string;
}

export function DeadlineDisplay({ deadlineAt, label = "Universal Match Deadline", consequenceText }: DeadlineDisplayProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const diffMs = new Date(deadlineAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft("Expired");
        setIsExpired(true);
        return;
      }
      
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) {
        setTimeLeft(`${diffDays}d ${diffHours}h remaining`);
      } else if (diffHours > 0) {
        setTimeLeft(`${diffHours}h ${diffMins}m remaining`);
      } else {
        setTimeLeft(`${diffMins}m remaining`);
      }
      setIsExpired(false);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  const dateStr = new Date(deadlineAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`p-3 border rounded-none space-y-1 text-xs ${isExpired ? "bg-[var(--color-danger-bg)] border-[var(--color-danger)] text-[var(--color-danger)]" : "bg-[var(--bg-app)] border-[var(--border-app)] text-[var(--text-app)]"}`}>
      <div className="flex items-center justify-between font-bold">
        <span className="font-serif uppercase tracking-tight">{label}</span>
        <span className={`font-mono ${isExpired ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}`}>
          {timeLeft}
        </span>
      </div>
      <div className="text-[10px] text-stone-400 font-mono">
        Expires: {dateStr}
      </div>
      {consequenceText && (
        <div className="text-[10px] italic opacity-85 mt-1 border-t border-[var(--border-subtle)] pt-1">
          {consequenceText}
        </div>
      )}
    </div>
  );
}
