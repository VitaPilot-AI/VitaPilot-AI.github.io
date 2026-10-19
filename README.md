# Retired static SolveMate website

The canonical SolveMate website and interactive demo are now maintained together in the Next.js application in [`../code`](../code). Its intended public home is **https://vitapilotai.com/**.

This repository is prepared for retirement. `index.html` is a small accessible redirect/link page for the former static origin. It is **not a second marketing source**. The unused `styles.css` and `main.js` remain temporarily for archival review and can be removed once the domain cutover is approved and verified. Do not continue editing their marketing content.

## Deployment order

1. Complete and review the consolidated Next.js homepage and demo entry flow in the application repository.
2. Deploy the application, attach `vitapilotai.com` to that deployment, and complete the approved DNS/custom-domain cutover. Keep the current GitHub Pages custom-domain binding and the live branch's `CNAME` file until the application is verified at the apex domain; this pending branch does not change either service.
3. Verify that `https://vitapilotai.com/` serves the consolidated application over HTTPS and that all three demo personas and both guided tours work through that domain.
4. Only after the apex cutover and HTTPS checks above pass, remove `vitapilotai.com` from this repository's GitHub Pages custom-domain setting, then merge this retirement branch, including its deletion of `CNAME`. Both changes are required: leaving the file in place can reattach the old custom domain on a later Pages deployment. Publish the retirement page at the retained `vitapilot-ai.github.io` origin or disable the old Pages deployment. Do **not** publish it while the apex domain still serves this repository: visitors would see the retirement page instead of the application.
5. Verify that the retained old origin redirects to `https://vitapilotai.com/` and that its accessible link also works with JavaScript disabled. Archive the remaining unused assets after approval.

The redirect deliberately skips `vitapilotai.com` and `www.vitapilotai.com` to prevent a self-redirect loop during an accidental early publication. It also skips local HTTP previews. This guard is a fallback, not a replacement for the deployment order above.

This pending branch removes `CNAME` for the eventual retirement deployment. The live branch retains its file until the verified cutover and the merge in step 4. The search-engine verification text file is preserved unchanged. No production, DNS or GitHub Pages settings were changed while preparing this retirement.
