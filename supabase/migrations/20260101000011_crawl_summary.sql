-- Robots/sitemap presence captured per crawl (RS-203).
alter table public.crawls
  add column if not exists robots_found boolean,
  add column if not exists sitemap_found boolean;
