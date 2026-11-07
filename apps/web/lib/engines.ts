/** Display labels and token colours for each tracked engine. */
export const ENGINE_META: Record<string, { label: string; cssVar: string }> = {
  google_organic: { label: "Google", cssVar: "--engine-google-organic" },
  ai_overview: { label: "AI Overviews", cssVar: "--engine-ai-overview" },
  ai_mode: { label: "AI Mode", cssVar: "--engine-ai-mode" },
  chatgpt: { label: "ChatGPT", cssVar: "--engine-chatgpt" },
  gemini: { label: "Gemini", cssVar: "--engine-gemini" },
  perplexity: { label: "Perplexity", cssVar: "--engine-perplexity" },
  claude: { label: "Claude", cssVar: "--engine-chatgpt" },
  copilot: { label: "Copilot", cssVar: "--engine-ai-overview" },
};

export function engineLabel(code: string): string {
  return ENGINE_META[code]?.label ?? code;
}

export function engineColor(code: string): string {
  const v = ENGINE_META[code]?.cssVar ?? "--primary";
  return `var(${v})`;
}
