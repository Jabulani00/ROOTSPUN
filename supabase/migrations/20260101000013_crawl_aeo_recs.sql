-- Store the de-duplicated AEO recommendations from a crawl so the "how to rank
-- higher" strategy can include AI-answer fixes, not just the score (RS-204/205).
alter table public.crawls
  add column if not exists aeo_recs jsonb not null default '[]'::jsonb;
