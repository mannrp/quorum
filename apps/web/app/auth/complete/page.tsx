"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui";
import { authDestination } from "@/lib/auth-routing";
import { userFacingError } from "@/lib/operations/client";
import { useAuthContext } from "@/lib/auth-context";

export default function AuthCompletePage() {
  const router = useRouter();
  const { sessionState } = useAuthContext();
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(async () => {
    try {
      setError(null);
      router.replace(await authDestination());
    } catch (err) {
      setError(userFacingError(err));
    }
  }, [router]);

  useEffect(() => {
    void finish();
  }, [finish]);

  return (
    <div className="max-w-md mx-auto py-12">
      <Section title="Completing Sign In" className="shadow-none">
        {error ? (
          <div className="space-y-3">
            <p className="text-xs text-rose-500 font-bold font-mono">{error}</p>
            {sessionState === "anonymous" ? (
              <Link href="/auth/login" className="btn-primary inline-block px-4 py-2 text-xs">
                Return to Login
              </Link>
            ) : (
              <button onClick={() => void finish()} className="btn-primary inline-block px-4 py-2 text-xs">
                Retry
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-stone-500 animate-pulse uppercase tracking-wider">
            Checking your Quorum profile...
          </p>
        )}
      </Section>
    </div>
  );
}
