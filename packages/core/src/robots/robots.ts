/**
 * robots.txt parsing per bot (RS-203) — pure, testable.
 *
 * Implements Google's matching rules: the group whose user-agent is the most
 * specific match applies; within it, the longest matching path pattern wins, and
 * on a tie Allow beats Disallow. Supports `*` wildcards and a trailing `$`
 * end-anchor. The live-fetch / CDN / log-analysis parts stay external.
 */

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}
export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

/** Parse robots.txt text into user-agent groups. */
export function parseRobots(content: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // Consecutive user-agent lines share one group.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      current.rules.push({ allow: field === "allow", pattern: value });
      lastWasAgent = false;
    }
  }
  return groups;
}

function agentSpecificity(agent: string, bot: string): number {
  if (agent === "*") return 0;
  return bot.toLowerCase().includes(agent) ? agent.length : -1;
}

/** Choose the most specific group matching the bot, or null. */
function selectGroup(groups: RobotsGroup[], bot: string): RobotsGroup | null {
  let best: { group: RobotsGroup; spec: number } | null = null;
  for (const g of groups) {
    const spec = Math.max(...g.agents.map((a) => agentSpecificity(a, bot)), -1);
    if (spec >= 0 && (!best || spec > best.spec)) best = { group: g, spec };
  }
  return best?.group ?? null;
}

function patternToRegex(pattern: string): RegExp {
  let end = false;
  let p = pattern;
  if (p.endsWith("$")) {
    end = true;
    p = p.slice(0, -1);
  }
  const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + (end ? "$" : ""));
}

function specificity(pattern: string): number {
  return pattern.replace(/\*/g, "").replace(/\$$/, "").length;
}

/**
 * Whether `path` is crawlable by `bot` per the robots.txt `content`.
 * Default-allow when no rule applies (standard behaviour).
 */
export function isPathAllowed(content: string, bot: string, path: string): boolean {
  const group = selectGroup(parseRobots(content), bot);
  if (!group) return true;

  let decision: { allow: boolean; spec: number } | null = null;
  for (const rule of group.rules) {
    if (rule.pattern === "") continue; // empty Disallow imposes no restriction
    if (!patternToRegex(rule.pattern).test(path)) continue;
    const spec = specificity(rule.pattern);
    if (
      !decision ||
      spec > decision.spec ||
      (spec === decision.spec && rule.allow && !decision.allow) // tie → Allow wins
    ) {
      decision = { allow: rule.allow, spec };
    }
  }
  return decision ? decision.allow : true;
}
