# TikTok Repost Remover (Chrome / Edge extension, Manifest V3)

Removes reposts from **your own** TikTok profile, one at a time, by working through
the TikTok tab you are already logged into, the same way you would by hand.

- It never asks for, reads, stores or sends your username, password, cookies or tokens.
  It makes no network requests. Its only permissions are `storage` (your settings),
  `scripting` and access to `https://www.tiktok.com/*`.
- It does not try to get around CAPTCHAs, verification prompts, rate limits or warnings.
  If one appears, the run stops immediately and the extension tells you why.
- It clicks only through the DOM (`element.click()` on elements found by `data-e2e`
  attributes, roles, aria-labels and exact text). It never clicks by screen coordinates.
- **Dry run is ON by default.**

## Architecture

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest. Injects `selectors.js` and `content.js` on `www.tiktok.com`. |
| `selectors.js` | **All TikTok-specific knowledge**: selectors, text patterns and detection functions (`findRemoveRepostControl`, `detectBlocker`, …). It only finds elements and never clicks. Each guess about TikTok's markup is tagged `[TIKTOK-SELECTOR]`. |
| `content.js` | The engine, running inside the TikTok tab. It holds the run state, the Start/Pause/Resume/Stop logic, the one-repost-at-a-time loop, verification, scroll-loading, the log and a small on-page status panel with Pause/Resume/Stop (in a closed Shadow DOM, so TikTok selectors never see it). |
| `popup.html` / `popup.js` / `popup.css` | Toolbar popup: controls, settings, counters and the activity log. It holds no automation state, because Chrome closes the popup whenever you click elsewhere; it sends commands to `content.js` and draws what comes back. |
| `background.js` | Stateless MV3 service worker. It saves the default settings on install and shows the run status as the toolbar badge. |

Flow for each repost (`content.js → processItem`):

1. Look up the grid item again by its video id. Element references are never reused, which avoids acting on a stale element.
2. Click its link, then wait until the URL shows **that** id (`/video/<id>` or `/photo/<id>`).
3. Open the Share menu (hover first, then click if hovering doesn't open it).
4. Look for a visible control whose whole text is exactly **"Remove repost"**. If it isn't there, the repost is **skipped** and nothing else is clicked.
5. Dry run: log it and click nothing. Live run: after a randomized delay, check again that the open video is still the same id and that the control still says "Remove repost". Then click it **once**.
6. Confirm the removal. Either TikTok's "Repost removed" toast appears, or the re-opened menu shows "Repost" instead of "Remove repost". "Repost" is **never** clicked, because that would repost the video again. If neither happens, the item is counted as **failed (unverified)**.
7. Close the video (close button, then Escape, then browser Back as a last resort) and check that you are back on the same profile grid.

The loop ends when there are no unprocessed reposts left after 3 scroll attempts, when the max-reposts limit is reached, when a blocker appears, when the page can't be recognized, or when you press Stop. After a set number of skips or failures in a row (3 by default), it pauses automatically.

## Install (unpacked)

1. Download or clone this folder (`tiktok-repost-remover/`) to your computer.
2. Chrome: open `chrome://extensions`. Edge: open `edge://extensions`.
3. Turn on **Developer mode** (a toggle at the top right in Chrome, or in the left sidebar in Edge).
4. Click **Load unpacked** and select the `tiktok-repost-remover` folder (the one that contains `manifest.json`).
5. Optional: pin the extension using the puzzle-piece icon in the toolbar.

After editing any file, click the reload (↻) icon on the extension's card and then **reload the TikTok tab**.

## Use

1. Log in to TikTok in Chrome yourself.
2. Go to your profile (`https://www.tiktok.com/@yourname`) and click the **Reposts** tab. Wait for the grid to load.
3. Click the extension icon, check the settings and click **Start**.
4. Keep the TikTok tab **in the foreground**. Chrome slows timers in background tabs, which makes the tool very slow.
5. You can stop at any time from the popup or from the small panel in the bottom-left corner of the page. **Stop** cancels the pending wait or click right away.

Settings:

- **Dry run** (on by default). Choose a depth:
  - *Inspect*: opens each video and its Share menu and checks that "Remove repost" is there, but **never clicks it**.
  - *List only*: scrolls the grid and lists the reposts it finds, with **no clicks at all**.
- **Min/Max delay**: a random wait between actions. The default is 2–5 s. The minimum allowed is 0.2 s; for maximum speed use 0.2–0.5 s, but TikTok is more likely to show a "too fast" warning (the run then stops by itself).
- **Max reposts / run**: how many reposts to process per run (50 by default).
- **Auto-pause after N problems**: pauses after N skips or failures in a row (3 by default).
- **Require "Edit profile"**: refuses to run unless this is clearly your own profile.

A live run (dry run unticked) needs a **second click on Start within 5 seconds**.

## Testing safely with dry-run mode

1. Leave **Dry run** ticked and set the depth to **List only**. Click Start.
   - The log should start with `Preflight OK on @yourname — N repost(s) visible`, followed by one `would open … and click "Remove repost"` line per repost, and then scroll attempts.
   - If preflight fails, the log tells you which part of the page wasn't recognized (see Debugging below).
2. Switch the depth to **Inspect**, set **Max reposts** to `3` and click Start.
   - Watch it open each video, open the Share menu and close the video again.
   - Every item should log `DRY RUN — found "Remove repost"; did NOT click it`.
   - A `Skipped … not found` result means a selector needs updating. Don't go live yet.
3. Do the first live run small: untick Dry run, set **Max reposts** to `1`, click Start twice and watch. Check the log for `Removed repost … (verified via …)`, then refresh the page to confirm the repost is gone.
4. Then raise Max reposts. Keep the delays conservative.

## Debugging selectors when TikTok changes its UI

All TikTok-specific selectors are in **`selectors.js`** and are marked `[TIKTOK-SELECTOR]`.

1. **Diagnose page**: on the Reposts tab, open the popup and click *Diagnose page*. The log shows what was detected: profile page, own profile, Reposts tab and whether it's selected, number of visible items, sample ids, and the share, close and Remove-repost controls.
   Run it again while a video is open with its Share menu showing, so it reports the menu controls too.
2. **Use the console in the extension's context**: open DevTools (F12) → Console. Change the context dropdown at the top-left from `top` to **TikTok Repost Remover**. Then you can run:
   ```js
   TRR.diagnose()
   TRR_SEL.collectRepostItems()        // [{id, href, link}]
   TRR_SEL.getRepostsTab()             // {found, selected, el}
   TRR_SEL.findShareButton()
   TRR_SEL.findRemoveRepostControl()   // open a video's Share menu first
   TRR_SEL.detectBlocker()
   ```
3. **Inspect the live DOM**: right-click the element (the Reposts tab, a grid tile, the Share icon, the "Remove repost" menu item) → *Inspect*. Look for a `data-e2e="…"` attribute on it or a nearby ancestor, or a `role` / `aria-label`. Add it to the **front** of the matching array in `SEL` (for example `SEL.share`, `SEL.item` or `SEL.repostsTab`).
4. **Text changes**: if TikTok renames a label (for example "Remove repost"), or your TikTok is not in English, edit the regexes in `TEXT`. Keep `removeRepost` an exact `^…$` match.
5. Common symptoms:

   | Symptom | Check |
   | --- | --- |
   | `Could not find the "Reposts" tab` | `SEL.repostsTab`, `TEXT.repostsTab` |
   | `"Edit profile" button not found` | `SEL.editProfile`, or untick the own-profile check |
   | `0 repost(s) visible` | `SEL.item`, `SEL.itemList`, `SEL.itemLink` |
   | `video did not open (URL never showed its id)` | TikTok stopped changing the URL; adjust `getOpenDetailId()` |
   | `Share button not found` | `SEL.share` |
   | `"Remove repost" option not found` | `TEXT.removeRepost`, `SEL.menuTextCandidates` |
   | `Could not close the video overlay` | `SEL.close`, `TEXT.closeLabel` |
   | False "TikTok protection detected" | `TEXT.blockers`, `SEL.captcha` (a false positive only stops the run) |

6. Reload the extension and the TikTok tab, then test again in dry run.

## Known limitations

- The UI text must be in English unless you add translations to `TEXT`.
- TikTok must open videos as an overlay on the profile and change the URL to `/video/<id>`, which is what it does today. If TikTok switches to full page loads, the run stops safely when the page unloads.
- Removed reposts may stay visible in the grid until you refresh. The tool tracks processed ids, so it never handles the same item twice in one run.
- Keep the tab visible while it runs. Chrome throttles timers in hidden tabs.
- The extension uses DOM events (`element.click()`). If TikTok ever ignores those, items will show as **failed (unverified)** instead of being reported as removed.
