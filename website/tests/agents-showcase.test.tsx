import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentsShowcase } from "@/components/agents-showcase";

describe("AgentsShowcase", () => {
  it("renders all five agents by name", () => {
    render(<AgentsShowcase />);
    for (const name of ["Extractor", "Risk", "Rights", "Red-Team", "Judge"]) {
      expect(screen.getByRole("heading", { name, level: 3 })).toBeInTheDocument();
    }
  });

  it("includes the RAG retrieval card", () => {
    render(<AgentsShowcase />);
    expect(screen.getByRole("heading", { name: "RAG", level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/24-statute KB/i)).toBeInTheDocument();
  });
});
