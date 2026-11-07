import { describe, expect, it } from "vitest";
import { brandCssRule, brandCssVars, hexToHslTriplet, luminance } from "./brand.js";

describe("hexToHslTriplet", () => {
  it("converts known colours", () => {
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#ff0000")).toBe("0 100% 50%");
    expect(hexToHslTriplet("#00ff00")).toBe("120 100% 50%");
    expect(hexToHslTriplet("#0000ff")).toBe("240 100% 50%");
  });
  it("tolerates missing hash", () => {
    expect(hexToHslTriplet("ff0000")).toBe("0 100% 50%");
  });
  it("returns null for invalid input", () => {
    expect(hexToHslTriplet("not-a-color")).toBeNull();
    expect(hexToHslTriplet("#fff")).toBeNull();
  });
});

describe("luminance", () => {
  it("is ~1 for white and ~0 for black", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 2);
    expect(luminance("#000000")).toBeCloseTo(0, 2);
  });
});

describe("brandCssVars", () => {
  it("is empty without a valid primary", () => {
    expect(brandCssVars(null)).toEqual({});
    expect(brandCssVars({ primary: "bad" })).toEqual({});
  });
  it("sets primary/ring and a contrasting foreground", () => {
    const dark = brandCssVars({ primary: "#2f9e6b" });
    expect(dark["--primary"]).toBe(hexToHslTriplet("#2f9e6b"));
    expect(dark["--ring"]).toBe(dark["--primary"]);
    expect(dark["--primary-foreground"]).toBe("0 0% 100%"); // light text on a mid-dark green

    const light = brandCssVars({ primary: "#f5f5dc" });
    expect(light["--primary-foreground"]).toBe("170 24% 12%"); // dark text on a light colour
  });
});

describe("brandCssRule", () => {
  it("serialises to a :root rule or empty string", () => {
    expect(brandCssRule(null)).toBe("");
    const rule = brandCssRule({ primary: "#ff0000" });
    expect(rule.startsWith(":root{")).toBe(true);
    expect(rule).toContain("--primary: 0 100% 50%;");
  });
});
