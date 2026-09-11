# Diet Copilot Read-only Dashboard QA

## Automated

- [x] split dashboard JavaScript parses
- [x] `sw.js` parses
- [x] manifest parses
- [x] no duplicate static IDs
- [x] all service-worker core assets exist
- [x] fresh dashboard shows ChatGPT-as-logger message
- [x] fresh dashboard has no manual logging controls
- [x] legacy V1 local state migrates to read-only cache
- [x] migrated meal totals render
- [x] migrated weight renders
- [x] browser client contains no Supabase `upsert`, `insert`, or nutrition delete operations
- [x] browser client does not invoke meal/weight write RPCs

## Manual / live Supabase

- [ ] existing authenticated session reconnects
- [ ] fresh sign-in works
- [ ] dashboard loads current schema-v5 rows
- [ ] ChatGPT-created meal appears after Realtime event
- [ ] ChatGPT correction updates dashboard automatically
- [ ] ChatGPT weight entry updates dashboard automatically
- [ ] 3/7/14/30/90/all ranges behave correctly with real data
- [ ] offline cached dashboard loads after one successful refresh
- [ ] Android Chrome/PWA layout
- [ ] desktop Chromium
- [ ] desktop Firefox
