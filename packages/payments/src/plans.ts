/** Subscription plans (RS-405 / FR-27). Prices in USD per month. */
export type PlanId = "starter" | "growth" | "scale";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  /** Monthly prompt-run allowance (metering cap, RS-110). */
  promptRunsPerMonth: number;
  /** Max clients tracked. */
  clients: number;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: { id: "starter", name: "Starter", priceUsd: 99, promptRunsPerMonth: 50_000, clients: 5 },
  growth: { id: "growth", name: "Growth", priceUsd: 299, promptRunsPerMonth: 200_000, clients: 25 },
  scale: { id: "scale", name: "Scale", priceUsd: 799, promptRunsPerMonth: 1_000_000, clients: 200 },
};

export function planRunLimit(id: PlanId): number {
  return PLANS[id].promptRunsPerMonth;
}
