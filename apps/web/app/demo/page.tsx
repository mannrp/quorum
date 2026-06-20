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
    <div className="dashboard-stage mx-auto max-w-6xl space-y-8 px-4 py-4">
      <section className="workspace-hero">
        <div className="space-y-3">
          <span className="page-kicker">Login-free demos</span>
          <div className="space-y-2">
            <h1 className="page-title">Explore Quorum as a real user</h1>
            <p className="page-subtitle">
              Choose a seeded persona to test the real workflows without Neon Auth. Use a separate demo database or Neon branch for this mode.
            </p>
          </div>
        </div>
      </section>

      {!enabled && (
        <Section title="Demo Mode Disabled">
          <p className="text-sm">
            Set <code>NEXT_PUBLIC_ENABLE_DEMO_MODE=true</code> in the web environment and <code>ENABLE_DEMO_MODE=true</code> in the API environment to enable these demos.
          </p>
        </Section>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="stagger-in grid gap-5 md:grid-cols-3">
        {DEMO_PERSONAS.map((persona) => (
          <section key={persona.id} className="directory-card min-h-64">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--accent-app)]">{persona.label}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-normal text-[var(--text-app)]">{persona.role}</h2>
              </div>
              <p className="text-sm leading-6 text-[var(--muted-app)]">{persona.description}</p>
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
