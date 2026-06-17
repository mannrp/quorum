"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_PERSONAS, DemoPersona, demoModeEnabled } from "@/lib/demo";
import { Section } from "@/components/ui";

type PersonaResponse = {
  target?: string;
  error?: string;
};

export default function DemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = demoModeEnabled();

  const launchPersona = async (persona: DemoPersona) => {
    setLoading(persona);
    setError(null);
    try {
      const response = await fetch("/api/demo/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const payload = (await response.json()) as PersonaResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Could not launch demo persona.");
      }
      router.push(payload.target || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch demo persona.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <div className="border-b border-[var(--border-subtle)] pb-5">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent-app)]">Login-free demos</p>
        <h1 className="mt-2 font-serif text-4xl font-black uppercase tracking-tight text-[var(--text-app)]">Explore Quorum as a real user</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          Choose a seeded persona to use the real product workflows without Neon Auth. Demo mode should point at a separate demo database or Neon branch.
        </p>
      </div>

      {!enabled && (
        <Section title="Demo Mode Disabled">
          <p className="text-sm">
            Set <code>NEXT_PUBLIC_ENABLE_DEMO_MODE=true</code> in the web environment and <code>ENABLE_DEMO_MODE=true</code> in the API environment to enable these demos.
          </p>
        </Section>
      )}

      {error && (
        <div className="border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {DEMO_PERSONAS.map((persona) => (
          <section key={persona.id} className="panel flex min-h-64 flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent-app)]">{persona.label}</p>
                <h2 className="mt-2 font-serif text-2xl font-black uppercase tracking-tight text-[var(--text-app)]">{persona.role}</h2>
              </div>
              <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{persona.description}</p>
            </div>
            <button
              type="button"
              onClick={() => launchPersona(persona.id)}
              disabled={!enabled || loading !== null}
              className="btn-primary w-full py-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === persona.id ? "Launching..." : "Launch Demo"}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
