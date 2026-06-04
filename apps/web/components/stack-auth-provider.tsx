"use client";

import { StackProvider } from "@stackframe/stack";
import { ReactNode } from "react";
import { stackApp } from "@/lib/stack";

export function QuorumStackProvider({ children }: { children: ReactNode }) {
  return <StackProvider app={stackApp}>{children}</StackProvider>;
}
