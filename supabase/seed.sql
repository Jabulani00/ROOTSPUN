-- Seed data: engines (global reference) + Google rules mirror.
-- A demo agency/client is created at runtime by the onboarding flow so it is
-- owned by a real auth user; seeding tenant rows without an auth.users row would
-- violate the membership model.

insert into public.engines (code) values
  ('google_organic'),
  ('ai_overview'),
  ('ai_mode'),
  ('chatgpt'),
  ('gemini'),
  ('perplexity'),
  ('claude'),
  ('copilot')
on conflict (code) do nothing;

insert into public.google_rules (id, title, url, summary) values
  ('rule.indexing.noindex', 'Block search indexing with noindex',
   'https://developers.google.com/search/docs/crawling-indexing/block-indexing',
   'A noindex rule tells Google to drop the page from search results.'),
  ('rule.crawl.blocked', 'Introduction to robots.txt',
   'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
   'robots.txt controls which URLs crawlers may fetch.'),
  ('rule.snippet.nosnippet', 'Control snippets in search results',
   'https://developers.google.com/search/docs/appearance/snippet',
   'nosnippet limits the text Google may show and suppresses AI quoting.'),
  ('rule.cwv.poor', 'Core Web Vitals and Google Search',
   'https://developers.google.com/search/docs/appearance/core-web-vitals',
   'Good thresholds: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.'),
  ('rule.content.no_answer', 'Creating helpful, people-first content',
   'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
   'Content should directly satisfy the searcher''s intent.'),
  ('rule.content.competitor_cited', 'Search Essentials',
   'https://developers.google.com/search/docs/essentials',
   'Results cite the sources that best demonstrate relevance and E-E-A-T.'),
  ('rule.spam.scaled_content', 'Scaled content abuse',
   'https://developers.google.com/search/docs/essentials/spam-policies#scaled-content-abuse',
   'Mass-produced low-value pages violate the spam policies.'),
  ('rule.spam.doorway', 'Doorway abuse',
   'https://developers.google.com/search/docs/essentials/spam-policies#doorways',
   'Near-identical pages funnelling users to one destination are doorways.'),
  ('rule.spam.site_reputation', 'Site reputation abuse',
   'https://developers.google.com/search/docs/essentials/spam-policies#site-reputation-abuse',
   'Hosting third-party content to exploit a domain''s authority is abuse.')
on conflict (id) do nothing;
