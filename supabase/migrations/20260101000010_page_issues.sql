-- Store the per-page technical-SEO issues found during a crawl (RS-201).
alter table public.pages
  add column if not exists issues jsonb not null default '[]'::jsonb;
