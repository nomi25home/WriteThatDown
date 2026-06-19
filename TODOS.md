# WriteThatDown — Deferred Work

## P2: Site License Tier Architecture
**What:** Design and implement a site license that multiple seats can use without requiring each user to know the IT admin's email address.
**Why:** One $149 site license sale = one month at the $50-150/month revenue target. The current HMAC(email, SECRET) architecture doesn't work for shared keys without storing the buyer's email alongside the key — and the UX of "50 nurses each entering their admin's email" is awkward.
**Options to evaluate:**
- (a) Store {key, owner_email} pair; each seat enters both the key AND the admin's email
- (b) Random opaque token in Cloudflare KV with activation count limit per license
- (c) License file (signed by the Worker) containing org name + seat count
**Context:** Dropped from Week 1 due to UX complexity. Revisit after first 3 individual sales prove the model.
**Depends on:** Individual tier shipping first

## P3: Free Tier Step Limit (5 steps per guide)
**What:** Limit free users to 5 steps per recorded guide. If guide.length > 5 AND no license key, disable PDF/Markdown/HTML export buttons and show upgrade prompt.
**Why:** Creates upgrade pressure earlier in the funnel. Users who need to document a 12-step process have no choice but to buy.
**Pros:** Earlier conversion signals; monetizes users who don't need PDF but need long guides.
**Cons:** Hurts the demo path for healthcare IT admins (EHR onboarding = 12+ steps). May cause frustration before trust is established.
**Context:** Dropped from Week 1 scope — PDF paywall is the primary gate. Revisit if 30-day cohort shows >50% of users are free-forever (using HTML export to bypass PDF paywall).
**Trigger:** Review after first 10 paying customers.

## P2: Service Worker Restart Regression Test
**What:** Add a regression test for the "CAPTURE_EVENT arrives before isRecording is restored from storage after SW restart" path. This is separate from the jsdom blur/mousedown test.
**Why:** Chrome kills the service worker after ~30s of inactivity. When it restarts mid-recording, the async `chrome.storage.local.get` restore (background.js:11-17) races with incoming CAPTURE_EVENTs. The fallback handler at background.js:127-136 handles this, but there's no test to prevent regression.
**How:** Mock `chrome.storage.local.get` with a delayed response. Send CAPTURE_EVENT before restore completes. Assert event is not dropped.
**Context:** Requires a Chrome extension testing harness (e.g., @extend-chrome/jest-chrome or wxt test utilities). More setup than jsdom. Worth doing after the jsdom tests are in place.
**Depends on:** Vitest setup from Week 1
