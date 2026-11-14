/**
 * Typed database shape.
 *
 * This is a hand-maintained mirror of the SQL migrations so the app and worker
 * are type-safe before a local Supabase is running. Once `supabase start` is up,
 * regenerate the authoritative version with:
 *
 *   pnpm db:types   # supabase gen types typescript --local > packages/db/src/types.ts
 */

export type AppRole = "owner" | "admin" | "analyst" | "client_viewer";
export type AgencyPlan = "trial" | "starter" | "growth" | "scale";
export type Sentiment = "positive" | "neutral" | "negative";
export type CauseConfidence = "high" | "medium" | "low";

type Row<T> = T;

export interface Database {
  public: {
    Tables: {
      agencies: {
        Row: Row<{
          id: string;
          name: string;
          plan: AgencyPlan;
          branding: Record<string, unknown>;
          custom_domain: string | null;
          created_at: string;
        }>;
        Insert: { name: string; plan?: AgencyPlan; branding?: Record<string, unknown>; custom_domain?: string | null };
        Update: Partial<{ name: string; plan: AgencyPlan; branding: Record<string, unknown>; custom_domain: string | null }>;
        Relationships: [];
      };
      memberships: {
        Row: Row<{
          id: string;
          agency_id: string;
          user_id: string;
          role: AppRole;
          client_id: string | null;
          created_at: string;
        }>;
        Insert: { agency_id: string; user_id: string; role?: AppRole; client_id?: string | null };
        Update: Partial<{ role: AppRole; client_id: string | null }>;
        Relationships: [];
      };
      clients: {
        Row: Row<{
          id: string;
          agency_id: string;
          name: string;
          country: string;
          language: string;
          created_at: string;
        }>;
        Insert: { agency_id: string; name: string; country?: string; language?: string };
        Update: Partial<{ name: string; country: string; language: string }>;
        Relationships: [];
      };
      domains: {
        Row: Row<{ id: string; agency_id: string; client_id: string; host: string; is_primary: boolean }>;
        Insert: { agency_id: string; client_id: string; host: string; is_primary?: boolean };
        Update: Partial<{ host: string; is_primary: boolean }>;
        Relationships: [];
      };
      competitors: {
        Row: Row<{ id: string; agency_id: string; client_id: string; name: string; host: string }>;
        Insert: { agency_id: string; client_id: string; name: string; host: string };
        Update: Partial<{ name: string; host: string }>;
        Relationships: [];
      };
      brand_terms: {
        Row: Row<{ id: string; agency_id: string; client_id: string; term: string; type: "brand" | "product" | "person" }>;
        Insert: { agency_id: string; client_id: string; term: string; type?: "brand" | "product" | "person" };
        Update: Partial<{ term: string; type: "brand" | "product" | "person" }>;
        Relationships: [];
      };
      prompts: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          text: string;
          topic: string | null;
          intent: string | null;
          priority: boolean;
          search_volume: number;
          created_at: string;
        }>;
        Insert: {
          agency_id: string;
          client_id: string;
          text: string;
          topic?: string | null;
          intent?: string | null;
          priority?: boolean;
          search_volume?: number;
        };
        Update: Partial<{ text: string; topic: string | null; priority: boolean; search_volume: number }>;
        Relationships: [];
      };
      scores_daily: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          engine_id: number | null;
          topic: string | null;
          date: string;
          uvs: number;
          share_of_voice: number;
          confidence: string;
        }>;
        Insert: {
          agency_id: string;
          client_id: string;
          engine_id?: number | null;
          topic?: string | null;
          date: string;
          uvs: number;
          share_of_voice?: number;
          confidence?: string;
        };
        Update: Partial<{ uvs: number; share_of_voice: number; confidence: string }>;
        Relationships: [];
      };
      usage_events: {
        Row: Row<{
          id: string;
          agency_id: string;
          kind: "prompt_run" | "page_crawl";
          qty: number;
          cost_usd: number;
          at: string;
        }>;
        Insert: { agency_id: string; kind: "prompt_run" | "page_crawl"; qty?: number; cost_usd?: number };
        Update: Partial<{ qty: number; cost_usd: number }>;
        Relationships: [];
      };
      engines: {
        Row: Row<{ id: number; code: string }>;
        Insert: { code: string };
        Update: Partial<{ code: string }>;
        Relationships: [];
      };
      runs: {
        Row: Row<{
          id: string;
          agency_id: string;
          prompt_id: string;
          engine_id: number;
          run_at: string;
          sample_no: number;
          raw_ref: string | null;
          cost_usd: number;
        }>;
        Insert: {
          agency_id: string;
          prompt_id: string;
          engine_id: number;
          sample_no?: number;
          raw_ref?: string | null;
          cost_usd?: number;
        };
        Update: Partial<{ raw_ref: string | null; cost_usd: number }>;
        Relationships: [];
      };
      mentions: {
        Row: Row<{
          id: string;
          agency_id: string;
          run_id: string;
          entity: string;
          position: number | null;
          sentiment: Sentiment | null;
        }>;
        Insert: { agency_id: string; run_id: string; entity: string; position?: number | null; sentiment?: Sentiment | null };
        Update: Partial<{ position: number | null; sentiment: Sentiment | null }>;
        Relationships: [];
      };
      citations: {
        Row: Row<{
          id: string;
          agency_id: string;
          run_id: string;
          url: string;
          host: string;
          is_client: boolean;
          rank: number | null;
        }>;
        Insert: { agency_id: string; run_id: string; url: string; host: string; is_client?: boolean; rank?: number | null };
        Update: Partial<{ is_client: boolean; rank: number | null }>;
        Relationships: [];
      };
      causes: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          prompt_id: string | null;
          engine_id: number | null;
          type: string;
          evidence: Record<string, unknown>;
          rule_id: string | null;
          confidence: CauseConfidence;
          impact: number;
          status: "new" | "accepted" | "dismissed";
          created_at: string;
        }>;
        Insert: {
          agency_id: string;
          client_id: string;
          prompt_id?: string | null;
          engine_id?: number | null;
          type: string;
          evidence?: Record<string, unknown>;
          rule_id?: string | null;
          confidence?: CauseConfidence;
          impact?: number;
          status?: "new" | "accepted" | "dismissed";
        };
        Update: Partial<{ status: "new" | "accepted" | "dismissed"; impact: number }>;
        Relationships: [];
      };
      fixes: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          cause_id: string | null;
          title: string;
          kind: "dev" | "content" | "pr";
          brief: Record<string, unknown>;
          external_ref: string | null;
          status: "open" | "in_progress" | "shipped";
          shipped_at: string | null;
          created_at: string;
        }>;
        Insert: {
          agency_id: string;
          client_id: string;
          cause_id?: string | null;
          title: string;
          kind?: "dev" | "content" | "pr";
          brief?: Record<string, unknown>;
          external_ref?: string | null;
          status?: "open" | "in_progress" | "shipped";
        };
        Update: Partial<{
          title: string;
          kind: "dev" | "content" | "pr";
          brief: Record<string, unknown>;
          external_ref: string | null;
          status: "open" | "in_progress" | "shipped";
          shipped_at: string | null;
        }>;
        Relationships: [];
      };
      audit_requests: {
        Row: Row<{
          id: string;
          domain: string;
          competitors: string[];
          email: string;
          ip: string | null;
          status: string;
          result: Record<string, unknown> | null;
          created_at: string;
        }>;
        Insert: { domain: string; competitors?: string[]; email: string; ip?: string | null; status?: string };
        Update: Partial<{ status: string; result: Record<string, unknown> | null }>;
        Relationships: [];
      };
      subscriptions: {
        Row: Row<{
          agency_id: string;
          provider: "paystack" | "stripe";
          plan: AgencyPlan;
          status: string;
          period_end: string | null;
        }>;
        Insert: { agency_id: string; provider: "paystack" | "stripe"; plan?: AgencyPlan; status?: string; period_end?: string | null };
        Update: Partial<{ provider: "paystack" | "stripe"; plan: AgencyPlan; status: string; period_end: string | null }>;
        Relationships: [];
      };
      api_keys: {
        Row: Row<{
          id: string;
          agency_id: string;
          hash: string;
          scopes: string[];
          last_used_at: string | null;
          created_at: string;
        }>;
        Insert: { agency_id: string; hash: string; scopes?: string[] };
        Update: Partial<{ scopes: string[]; last_used_at: string | null }>;
        Relationships: [];
      };
      cwv_metrics: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          template: string;
          lcp_ms: number | null;
          inp_ms: number | null;
          cls: number | null;
          source: "crux" | "psi";
          date: string;
        }>;
        Insert: {
          agency_id: string;
          client_id: string;
          template: string;
          lcp_ms?: number | null;
          inp_ms?: number | null;
          cls?: number | null;
          source: "crux" | "psi";
          date?: string;
        };
        Update: Partial<{ lcp_ms: number | null; inp_ms: number | null; cls: number | null }>;
        Relationships: [];
      };
      crawler_access: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          bot: string;
          allowed: boolean;
          blocked_by: string | null;
          checked_at: string;
        }>;
        Insert: { agency_id: string; client_id: string; bot: string; allowed: boolean; blocked_by?: string | null };
        Update: Partial<{ allowed: boolean; blocked_by: string | null }>;
        Relationships: [];
      };
      fix_outcomes: {
        Row: Row<{
          id: string;
          agency_id: string;
          fix_id: string;
          metric: string;
          before: number | null;
          after: number | null;
          window_days: number;
        }>;
        Insert: { agency_id: string; fix_id: string; metric: string; before?: number | null; after?: number | null; window_days?: number };
        Update: Partial<{ before: number | null; after: number | null; window_days: number }>;
        Relationships: [];
      };
      integrations: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string | null;
          provider: "gsc" | "ga4";
          vault_secret_id: string | null;
          status: string;
          created_at: string;
        }>;
        Insert: { agency_id: string; client_id?: string | null; provider: "gsc" | "ga4"; vault_secret_id?: string | null; status?: string };
        Update: Partial<{ status: string; vault_secret_id: string | null }>;
        Relationships: [];
      };
      gsc_daily: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          date: string;
          query: string | null;
          page: string | null;
          clicks: number;
          impressions: number;
          position: number | null;
        }>;
        Insert: {
          agency_id: string;
          client_id: string;
          date: string;
          query?: string | null;
          page?: string | null;
          clicks?: number;
          impressions?: number;
          position?: number | null;
        };
        Update: Partial<{ clicks: number; impressions: number; position: number | null }>;
        Relationships: [];
      };
      reports: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          period: string;
          storage_path: string | null;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: { agency_id: string; client_id: string; period: string; storage_path?: string | null; created_by?: string | null };
        Update: Partial<{ storage_path: string | null }>;
        Relationships: [];
      };
      alerts: {
        Row: Row<{
          id: string;
          agency_id: string;
          client_id: string;
          kind: string;
          threshold: number;
          last_fired_at: string | null;
        }>;
        Insert: { agency_id: string; client_id: string; kind?: string; threshold?: number };
        Update: Partial<{ threshold: number; last_fired_at: string | null }>;
        Relationships: [];
      };
      google_rules: {
        Row: Row<{
          id: string;
          title: string;
          url: string;
          summary: string;
          checksum: string | null;
          last_changed_at: string | null;
        }>;
        Insert: { id: string; title: string; url: string; summary: string; checksum?: string | null };
        Update: Partial<{ checksum: string | null; last_changed_at: string | null }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_agency_ids: { Args: Record<string, never>; Returns: string[] };
      is_agency_member: { Args: { target: string }; Returns: boolean };
      request_client_refresh: { Args: { p_client_id: string }; Returns: number };
      connect_gsc_integration: { Args: { p_client_id: string; p_refresh_token: string }; Returns: string };
      gsc_refresh_token: { Args: { p_integration_id: string }; Returns: string };
      bootstrap_agency: { Args: { p_name: string }; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      agency_plan: AgencyPlan;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
