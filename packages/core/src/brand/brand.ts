/**
 * White-label branding (RS-307) — pure token derivation.
 *
 * Agencies store a brand colour; we derive the design-system CSS variables
 * (which are HSL triplets like "158 64% 32%") so their colours apply at runtime
 * with no rebuild. The foreground is chosen for contrast against the brand hue.
 */

export interface Branding {
  primary?: string; // hex, e.g. "#2f9e6b"
  logoUrl?: string;
  name?: string;
}

/** Convert a hex colour to an "H S% L%" triplet matching the token format. */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1]!, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Relative luminance (0–1) of a hex colour, for contrast decisions. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const int = parseInt(m[1]!, 16);
  const chan = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
}

/**
 * Build the CSS variable overrides for an agency's branding. Returns a map of
 * token name → value; empty when no valid primary colour is set.
 */
export function brandCssVars(branding: Branding | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!branding?.primary) return vars;
  const triplet = hexToHslTriplet(branding.primary);
  if (!triplet) return vars;
  vars["--primary"] = triplet;
  vars["--ring"] = triplet;
  // Pick a readable foreground on the brand colour.
  vars["--primary-foreground"] = luminance(branding.primary) > 0.5 ? "170 24% 12%" : "0 0% 100%";
  return vars;
}

/** Serialise brand vars into a CSS `:root { … }` rule (empty string if none). */
export function brandCssRule(branding: Branding | null | undefined): string {
  const vars = brandCssVars(branding);
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
  return body ? `:root{${body}}` : "";
}
