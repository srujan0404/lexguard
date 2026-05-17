import { describe, expect, it } from "vitest";
import { audioUrl, API_BASE } from "@/lib/api";

describe("api helpers", () => {
  it("audioUrl encodes the document id and defaults to English", () => {
    const url = audioUrl("doc_12345");
    expect(url).toBe(`${API_BASE}/api/v1/scans/doc_12345/audio?lang=en`);
  });

  it("audioUrl honours the requested language", () => {
    const url = audioUrl("doc_x/y", "hinglish");
    expect(url).toContain("doc_x%2Fy");
    expect(url.endsWith("?lang=hinglish")).toBe(true);
  });

  it("API_BASE points at the Cloud Run host by default", () => {
    expect(API_BASE).toMatch(/^https?:\/\//);
  });
});
