import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StatutesShowcase } from "@/components/statutes-showcase";

describe("StatutesShowcase", () => {
  it("renders three statute cards with read-summary affordance", () => {
    render(<StatutesShowcase onOpen={() => {}} />);
    expect(screen.getAllByText(/read summary/i)).toHaveLength(3);
  });

  it("calls onOpen with the statute id when a card is clicked", () => {
    const onOpen = vi.fn();
    render(<StatutesShowcase onOpen={onOpen} />);
    const ica = screen
      .getByRole("heading", { name: /agreements in restraint of trade are void/i })
      .closest("button");
    expect(ica).not.toBeNull();
    fireEvent.click(ica!);
    expect(onOpen).toHaveBeenCalledWith("ica_s27");
  });
});
