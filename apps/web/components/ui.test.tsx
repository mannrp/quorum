import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSkeleton, Status } from "./ui";

describe("shared UI test harness", () => {
  it("exposes loading state accessibly", () => {
    render(<LoadingSkeleton rows={2} />);
    expect(screen.getByRole("status", { name: "Loading content" })).toBeTruthy();
  });

  it("renders status text without rewriting the domain value", () => {
    render(<Status value="SUBMITTED_FOR_APPROVAL" />);
    expect(screen.getByText("SUBMITTED_FOR_APPROVAL").textContent).toBe("SUBMITTED_FOR_APPROVAL");
  });
});
