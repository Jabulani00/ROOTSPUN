import { brandCssRule, type Branding } from "@rootspun/core";

/**
 * Injects an agency's white-label brand colours (RS-307) by overriding the
 * design-system CSS tokens at runtime. Renders nothing when no branding is set.
 * The CSS is derived from a validated hex value, so it is not user-controlled markup.
 */
export function BrandStyle({ branding }: { branding: Branding | null | undefined }) {
  const css = brandCssRule(branding);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
