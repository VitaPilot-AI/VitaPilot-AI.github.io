# Retired static SolveMate website

The canonical SolveMate website and interactive demo are maintained together in the Next.js application at **https://vitapilotai.com/** ([source](https://github.com/VitaPilot-AI/solvemate)).

This repository was retired on 19 October 2026 Pacific after the [canonical live checks](https://github.com/VitaPilot-AI/solvemate/actions/runs/39373885924) passed all four tours, both homepage layouts, session lifecycle and smoke. Its Pages custom-domain binding was removed, and it has no `CNAME` file. `index.html` is a small accessible redirect/link page for the former `vitapilot-ai.github.io` origin. It is **not a second marketing source**. The unused `styles.css` and `main.js` remain for archival review; do not continue editing their marketing content.

## Deployment order

1. Complete and review the consolidated Next.js homepage and demo entry flow in the application repository.
2. Deploy the application, attach `vitapilotai.com` to that deployment, and complete the approved DNS/custom-domain cutover. Keep the GitHub Pages custom-domain binding and `CNAME` file until the application is verified at the apex domain.
3. Verify that `https://vitapilotai.com/` serves the consolidated application over HTTPS and that all three demo personas and both guided tours work through that domain.
4. Only after the apex cutover and HTTPS checks above pass, remove `vitapilotai.com` from this repository's GitHub Pages custom-domain setting, then merge this retirement branch, including its deletion of `CNAME`. Both changes are required: leaving the file in place can reattach the old custom domain on a later Pages deployment. Publish the retirement page at the retained `vitapilot-ai.github.io` origin or disable the old Pages deployment. Do **not** publish it while the apex domain still serves this repository: visitors would see the retirement page instead of the application.
5. Verify that the retained old origin redirects to `https://vitapilotai.com/` and that its accessible link also works with JavaScript disabled. Archive the remaining unused assets after approval.

The redirect deliberately skips `vitapilotai.com` and `www.vitapilotai.com` to prevent a self-redirect loop during an accidental early publication. It also skips local HTTP previews. This guard is a fallback, not a replacement for the deployment order above.

The search-engine verification text file is preserved unchanged. The original marketing site remains in Git history at `916d72012b3a866da1ece88bef6bbe86f8b26e36`; the application's domain-cutover runbook records the mail-preserving DNS change and rollback order. Restoring this source alone must not reattach the domain: any rollback also needs the reviewed Pages binding, `CNAME` and DNS restoration.
