import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TryNowButton } from "@/components/try-now-button";

describe("TryNowButton", () => {
  it("renders a link to /scan by default", () => {
    render(<TryNowButton />);
    const link = screen.getByRole("link", { name: /try lexguard/i });
    expect(link).toHaveAttribute("href", "/scan");
  });

  it("accepts a custom label and href", () => {
    render(<TryNowButton href="/compare" label="Compare two" />);
    const link = screen.getByRole("link", { name: /compare two/i });
    expect(link).toHaveAttribute("href", "/compare");
  });
});
