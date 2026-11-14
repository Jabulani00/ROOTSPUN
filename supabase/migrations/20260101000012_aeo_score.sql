-- AEO (answer-engine) readiness captured per crawl and per page (RS-204/205).
alter table public.crawls
  add column if not exists aeo_score int;

alter table public.pages
  add column if not exists aeo_score int;
