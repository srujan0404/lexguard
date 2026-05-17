import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeverityPill } from "@/components/severity-pill";

describe("SeverityPill", () => {
  it.each(["low", "medium", "high", "critical"] as const)(
    "renders severity %s with the corresponding tone class",
    (sev) => {
      render(<SeverityPill severity={sev} />);
      const label = screen.getByText(sev);
      expect(label).toBeInTheDocument();
    },
  );

  it("uses the accent tone for critical severity", () => {
    const { container } = render(<SeverityPill severity="critical" />);
    expect(container.querySelector(".text-accent")).not.toBeNull();
  });
});
