import rulesJson from "./google-rules.json" with { type: "json" };

export type RuleCategory =
  | "indexing"
  | "crawling"
  | "appearance"
  | "experience"
  | "content"
  | "spam";

export interface GoogleRule {
  id: string;
  title: string;
  url: string;
  summary: string;
  category: RuleCategory;
  whyGoogleCares: string;
  fixHint: string;
}

export interface GoogleRulesLibrary {
  version: string;
  source: string;
  rules: GoogleRule[];
}

const library = rulesJson as GoogleRulesLibrary;

const byId = new Map<string, GoogleRule>(library.rules.map((r) => [r.id, r]));

/** All rules in the library. */
export function allRules(): GoogleRule[] {
  return library.rules;
}

/** Look up a rule by its id (as referenced by the Why Engine). */
export function getRule(id: string): GoogleRule | undefined {
  return byId.get(id);
}

/** Rules in a given category — e.g. "spam" for the Fix Studio guardrail (RS-305). */
export function rulesByCategory(category: RuleCategory): GoogleRule[] {
  return library.rules.filter((r) => r.category === category);
}

export const RULES_VERSION = library.version;
