import { describe, expect, it } from "vitest";
import {
  extractAnswer,
  extractCitations,
  extractMentions,
  normalizeHost,
} from "./extract.js";
import { scoreSentiment, windowAround } from "./sentiment.js";

describe("normalizeHost", () => {
  it("strips scheme, www, path, query and port", () => {
    expect(normalizeHost("https://www.Acme.com/pricing?x=1")).toBe("acme.com");
    expect(normalizeHost("http://acme.com:8080/a")).toBe("acme.com");
    expect(normalizeHost("ACME.com")).toBe("acme.com");
    expect(normalizeHost("sub.acme.com")).toBe("sub.acme.com");
  });
});

describe("extractCitations", () => {
  it("normalises hosts, tags client, and ranks in order", () => {
    const cites = extractCitations(
      ["https://www.acme.com/a", "https://rival.com/b", "https://acme.com/c"],
      ["acme.com"],
    );
    expect(cites).toEqual([
      { host: "acme.com", isClient: true, rank: 1 },
      { host: "rival.com", isClient: false, rank: 2 },
      { host: "acme.com", isClient: true, rank: 3 },
    ]);
  });
});

describe("extractMentions", () => {
  const entities = [
    { entity: "client" as const, terms: ["Acme", "Acme Pro"] },
    { entity: "rival", terms: ["Globex"] },
  ];

  it("returns nothing when no entity is mentioned", () => {
    expect(extractMentions("nothing relevant here", entities)).toEqual([]);
  });

  it("orders mentions by first appearance and numbers positions", () => {
    const text = "Globex is popular, but Acme is the best choice.";
    const mentions = extractMentions(text, entities);
    expect(mentions.map((m) => m.entity)).toEqual(["rival", "client"]);
    expect(mentions.map((m) => m.position)).toEqual([1, 2]);
  });

  it("does not match a term inside a larger word", () => {
    // "crm" should not match inside "scrmble"
    const mentions = extractMentions("scrmble is unrelated", [
      { entity: "client", terms: ["crm"] },
    ]);
    expect(mentions).toEqual([]);
  });

  it("scores sentiment from the mention's surroundings", () => {
    const pos = extractMentions("Acme is the best, most trusted tool.", [
      { entity: "client", terms: ["Acme"] },
    ]);
    expect(pos[0]?.sentiment).toBe("positive");

    const neg = extractMentions("Acme is slow and expensive.", [
      { entity: "client", terms: ["Acme"] },
    ]);
    expect(neg[0]?.sentiment).toBe("negative");
  });
});

describe("scoreSentiment", () => {
  it("handles negation", () => {
    expect(scoreSentiment("this is not great")).toBe("negative");
    expect(scoreSentiment("not bad at all")).toBe("positive");
    expect(scoreSentiment("it is a tool")).toBe("neutral");
  });
});

describe("windowAround", () => {
  it("clamps to string bounds", () => {
    expect(windowAround("hello", 0, 2)).toBe("he");
    expect(windowAround("hello world", 6, 3).length).toBeGreaterThan(0);
  });
});

describe("extractAnswer", () => {
  it("combines mentions and citations", () => {
    const result = extractAnswer({
      text: "Acme is the leading CRM; see the comparison.",
      citedUrls: ["https://acme.com/x", "https://rival.com/y"],
      clientHosts: ["acme.com"],
      entities: [
        { entity: "client", terms: ["Acme"] },
        { entity: "rival", terms: ["Rival"] },
      ],
    });
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0]?.entity).toBe("client");
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]?.isClient).toBe(true);
  });
});
