export * from "./types.js";
export * as scoring from "./scoring/index.js";
export * as why from "./why/index.js";
export * as extract from "./extract/index.js";
export * as alerts from "./alerts/index.js";
export * as guardrail from "./guardrail/index.js";
export * as proof from "./proof/index.js";
export * as api from "./api/index.js";
export * as brand from "./brand/index.js";

// Convenience re-exports of the most common entry points.
export { scoreSlice, unifiedVisibilityScore, shareOfVoice, promptVisibility } from "./scoring/uvs.js";
export { diagnose, mostLikelyCause, impactScore } from "./why/diagnose.js";
export type { LossContext, Cause, CauseType, CauseEvidence } from "./why/types.js";
export { extractAnswer, extractMentions, extractCitations, normalizeHost } from "./extract/extract.js";
export type { ExtractInput, ExtractResult, EntityTerms } from "./extract/extract.js";
export { evaluateScoreDrop, DEFAULT_DROP_THRESHOLD, type AlertDecision } from "./alerts/alerts.js";
export { checkBrief } from "./guardrail/guardrail.js";
export type { FixBrief, BriefPage, GuardrailResult, GuardrailViolation, SpamPattern } from "./guardrail/guardrail.js";
export { computeLift, rankFixTypesByLift, windowElapsed, MEASUREMENT_WINDOWS_DAYS } from "./proof/proof.js";
export type { LiftInput, LiftResult, LiftMetric, FixTypeLift, RankedFixType } from "./proof/proof.js";
export { hasScope, parseBearer, validateScopes, API_SCOPES, type ApiScope } from "./api/scopes.js";
export { hexToHslTriplet, brandCssVars, brandCssRule, luminance, type Branding } from "./brand/brand.js";
