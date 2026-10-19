# Retired static SolveMate website

The canonical SolveMate website and interactive demo are now maintained together in the Next.js application in [`../code`](../code). Its intended public home is **https://vitapilotai.com/**.

This repository is prepared for retirement. `index.html` is a small accessible redirect/link page for the former static origin. It is **not a second marketing source**. The unused `styles.css` and `main.js` remain temporarily for archival review and can be removed once the domain cutover is approved and verified. Do not continue editing their marketing content.

## Deployment order

1. Complete and review the consolidated Next.js homepage and demo entry flow in the application repository.
2. Deploy the application, attach `vitapilotai.com` to that deployment, and complete the approved DNS/custom-domain cutover. Coordinate the old GitHub Pages custom-domain setting with the new hosting configuration; this local preparation does not change either service.
3. Verify that `https://vitapilotai.com/` serves the consolidated application over HTTPS and that all three demo personas and both guided tours work through that domain.
4. Only after the apex cutover is verified, publish this retirement page at any retained old GitHub Pages origin or disable the old Pages deployment. Do **not** publish it while the apex domain still serves this repository: visitors would see the retirement page instead of the application.
5. Verify that the retained old origin redirects to `https://vitapilotai.com/` and that its accessible link also works with JavaScript disabled. Archive the remaining unused assets after approval.

The redirect deliberately skips `vitapilotai.com` and `www.vitapilotai.com` to prevent a self-redirect loop during an accidental early publication. It also skips local HTTP previews. This guard is a fallback, not a replacement for the deployment order above.

`CNAME` and the verification text file are preserved unchanged for review. Their eventual removal or hosting-settings changes belong to the approved cutover, not this source-only change. No production, DNS or GitHub Pages settings were changed while preparing this retirement.
