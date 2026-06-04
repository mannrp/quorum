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
    <div className={`p-3 border rounded-lg space-y-1 text-xs ${isExpired ? "bg-rose-50/50 border-rose-250 dark:bg-rose-950/15 dark:border-rose-900 text-rose-800 dark:text-rose-350" : "bg-[#f8f9fa] dark:bg-[#111422] border-stone-250 dark:border-stone-850 text-stone-700 dark:text-slate-350"}`}>
      <div className="flex items-center justify-between font-bold">
        <span>{label}</span>
        <span className={`${isExpired ? "text-rose-600 dark:text-rose-450" : "text-amber-600 dark:text-amber-400"}`}>
          {timeLeft}
        </span>
      </div>
      <div className="text-[10px] text-stone-400">
        Expires: {dateStr}
      </div>
      {consequenceText && (
        <div className="text-[10px] italic opacity-85 mt-1 border-t border-stone-200/50 dark:border-stone-800/50 pt-1">
          {consequenceText}
        </div>
      )}
    </div>
  );
}
