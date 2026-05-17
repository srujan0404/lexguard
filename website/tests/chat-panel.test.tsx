import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatPanel } from "@/components/chat-panel";

describe("ChatPanel", () => {
  it("renders suggested questions as clickable buttons when expanded", () => {
    render(
      <ChatPanel
        documentId="doc_test"
        suggestedQuestions={[
          "Is the non-compete enforceable?",
          "Can the probation be extended forever?",
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Is the non-compete enforceable\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Can the probation be extended forever\?/i }),
    ).toBeInTheDocument();
  });

  it("toggles the expand/collapse control via the header button", () => {
    render(
      <ChatPanel
        documentId="doc_test"
        suggestedQuestions={["test q"]}
        defaultOpen={false}
      />,
    );
    const toggle = screen.getByRole("button", { name: /ask lexguard/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
