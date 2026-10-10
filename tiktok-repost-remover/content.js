/*
 * content.js — the automation engine. Runs inside the TikTok tab (isolated world).
 *
 * It never reads cookies, tokens or credentials and never makes network requests.
 * It only interacts with the page you are already logged into, through the DOM.
 *
 * All TikTok-specific detection lives in selectors.js (globalThis.TRR_SEL).
 */
(() => {
  'use strict';
  // Guard against double injection. If a previous copy exists but was orphaned by
  // an extension reload (its chrome.runtime is gone), stop it and take over.
  if (globalThis.TRR) {
    if (globalThis.TRR.isAlive()) return;
    try {
      globalThis.TRR.stop();
    } catch (_) {
      /* ignore */
    }
  }
  const S = globalThis.TRR_SEL;
  if (!S) {
    console.error('[TRR] selectors.js did not load; aborting.');
    return;
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  const DEFAULT_SETTINGS = Object.freeze({
    minDelaySec: 2,
    maxDelaySec: 5,
    maxActions: 50, // max reposts processed (attempted) per run
    dryRun: true, // SAFE DEFAULT: never removes anything until you untick it
    dryRunDepth: 'inspect', // 'list' = no clicks at all; 'inspect' = opens videos/menus, never clicks Remove
    maxConsecutiveProblems: 3, // auto-pause after this many skips/failures in a row
    requireOwnProfile: true, // refuse to run unless "Edit profile" is visible
  });

  function sanitizeSettings(raw) {
    const s = Object.assign({}, DEFAULT_SETTINGS, raw || {});
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    s.minDelaySec = Math.min(120, Math.max(1, num(s.minDelaySec, DEFAULT_SETTINGS.minDelaySec)));
    s.maxDelaySec = Math.min(300, Math.max(s.minDelaySec, num(s.maxDelaySec, DEFAULT_SETTINGS.maxDelaySec)));
    s.maxActions = Math.min(5000, Math.max(1, Math.floor(num(s.maxActions, DEFAULT_SETTINGS.maxActions))));
    s.maxConsecutiveProblems = Math.min(50, Math.max(1, Math.floor(num(s.maxConsecutiveProblems, 3))));
    s.dryRun = s.dryRun !== false;
    s.dryRunDepth = s.dryRunDepth === 'list' ? 'list' : 'inspect';
    s.requireOwnProfile = s.requireOwnProfile !== false;
    return s;
  }

  // Fixed (non-configurable) timeouts. Polling-based, so paused time is not counted.
  const T = {
    poll: 200,
    openDetail: 10000,
    menuHover: 1500,
    menuClick: 4000,
    verify: 6000,
    closeDetail: 5000,
    loadMore: 8000,
    maxEmptyScrolls: 3, // consecutive scrolls that load nothing → assume end of list
  };

  // ---------------------------------------------------------------------------
  // Run state
  // ---------------------------------------------------------------------------
  class StopError extends Error {
    constructor(msg = 'Stopped') {
      super(msg);
      this.name = 'StopError';
    }
  }
  class HaltError extends Error {
    // Ends the run (blocker, unsafe state, unrecognized UI) — not a per-item failure.
    constructor(msg) {
      super(msg);
      this.name = 'HaltError';
    }
  }

  const state = {
    status: 'idle', // idle | running | paused | stopping | stopped | done | halted | error
    message: 'Idle',
    removed: 0,
    identified: 0, // dry run: reposts that WOULD be removed
    skipped: 0,
    failed: 0,
    processed: 0,
    dryRun: true,
    dryRunDepth: 'inspect',
    startedAt: null,
    log: [],
  };
  let ctl = null; // { abort: AbortController, paused: boolean, waiters: [] , runId }
  let runPromise = null;
  let runCounter = 0;

  const MAX_LOG = 500;
  function log(level, msg) {
    const entry = { t: Date.now(), level, msg };
    state.log.push(entry);
    if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)('[TRR]', msg);
    broadcast();
  }

  function setStatus(status, message) {
    state.status = status;
    if (message !== undefined) state.message = message;
    broadcast();
  }

  function snapshot() {
    return {
      status: state.status,
      message: state.message,
      removed: state.removed,
      identified: state.identified,
      skipped: state.skipped,
      failed: state.failed,
      processed: state.processed,
      dryRun: state.dryRun,
      dryRunDepth: state.dryRunDepth,
      startedAt: state.startedAt,
      log: state.log.slice(-300),
      url: location.href,
    };
  }

  let broadcastTimer = null;
  function broadcast() {
    renderOverlay();
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null;
      try {
        chrome.runtime.sendMessage({ type: 'trr:state', state: snapshot() }).catch(() => {});
      } catch (_) {
        // Extension was reloaded/updated: this content script is orphaned.
        // Stop any run so nothing keeps clicking without a controller.
        if (ctl) ctl.abort.abort();
      }
    }, 150);
  }

  // ---------------------------------------------------------------------------
  // Cancellation-aware timing primitives
  // ---------------------------------------------------------------------------
  /** Throws StopError if stopped; waits while paused. Call before every action. */
  async function checkpoint() {
    for (;;) {
      if (!ctl || ctl.abort.signal.aborted) throw new StopError();
      if (!ctl.paused) return;
      await new Promise((resolve, reject) => {
        const onAbort = () => reject(new StopError());
        ctl.abort.signal.addEventListener('abort', onAbort, { once: true });
        ctl.waiters.push(() => {
          ctl.abort.signal.removeEventListener('abort', onAbort);
          resolve();
        });
      });
    }
  }

  function rawSleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new StopError());
      const onAbort = () => {
        clearTimeout(timer);
        reject(new StopError());
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** Sleep that stops instantly on Stop and freezes (doesn't count) while paused. */
  async function sleep(ms) {
    let remaining = ms;
    while (remaining > 0) {
      await checkpoint();
      const step = Math.min(remaining, 100);
      await rawSleep(step, ctl.abort.signal);
      remaining -= step;
    }
    await checkpoint();
  }

  /** Randomized delay within the configured range. */
  function humanDelay(settings, factor = 1) {
    const min = settings.minDelaySec * 1000 * factor;
    const max = settings.maxDelaySec * 1000 * factor;
    return sleep(Math.round(min + Math.random() * (max - min)));
  }

  /** Poll `fn` until truthy or timeout. Returns the value or null. Pause-aware. */
  async function waitFor(fn, timeoutMs, interval = T.poll) {
    const tries = Math.max(1, Math.ceil(timeoutMs / interval));
    for (let i = 0; i < tries; i++) {
      await checkpoint();
      let v = null;
      try {
        v = fn();
      } catch (e) {
        v = null;
      }
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // DOM interaction primitives (the only places that dispatch events)
  // ---------------------------------------------------------------------------
  function hover(el) {
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerover', opts));
    el.dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mousemove', opts));
  }

  function unhover(el) {
    if (!el || !el.isConnected) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerout', opts));
    el.dispatchEvent(new PointerEvent('pointerleave', { ...opts, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseout', opts));
    el.dispatchEvent(new MouseEvent('mouseleave', { ...opts, bubbles: false }));
  }

  /**
   * Click an element via the DOM (HTMLElement.click()). Never uses coordinates.
   * Always preceded by a checkpoint so Stop/Pause take effect first.
   */
  async function domClick(el, what) {
    await checkpoint();
    if (!el || !el.isConnected) throw new Error(`Element for "${what}" disappeared before click`);
    if (!S.isVisible(el)) throw new Error(`Element for "${what}" is not visible`);
    el.click();
  }

  function pressEscape() {
    const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document;
    const opts = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    target.dispatchEvent(new KeyboardEvent('keydown', opts));
    target.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------
  function assertNotBlocked() {
    const b = S.detectBlocker();
    if (b) throw new HaltError(`TikTok protection detected — stopped immediately. ${b}`);
    if (S.isLoggedOut()) throw new HaltError('You appear to be logged out of TikTok. Log in manually, then start again.');
  }

  function preflight(settings) {
    assertNotBlocked();
    if (location.hostname !== 'www.tiktok.com') throw new HaltError('Not on www.tiktok.com.');
    if (S.isDetailOpen()) throw new HaltError('A video is open. Close it so your profile grid is showing, then start again.');
    if (!S.isProfilePath()) throw new HaltError('Open your own profile page (tiktok.com/@yourname) first.');

    if (settings.requireOwnProfile) {
      if (!S.findEditProfile()) {
        throw new HaltError('Could not confirm this is YOUR profile ("Edit profile" button not found). ' + 'Open your own profile, or disable the own-profile check in settings if TikTok renamed it.');
      }
    }

    const tab = S.getRepostsTab();
    if (!tab.found) throw new HaltError('Could not find the "Reposts" tab. Open your profile → Reposts and try again.');
    if (tab.selected === false) throw new HaltError('The "Reposts" tab is not selected. Click it, wait for the grid to load, then start again.');
    if (tab.selected === null) log('warn', 'Could not confirm that the Reposts tab is selected (TikTok exposes no aria-selected). Make sure it is.');

    const items = S.collectRepostItems();
    log('info', `Preflight OK on @${S.profileHandle()} — ${items.length} repost(s) visible right now.`);
  }

  /** After returning from a video, we must be back on the same profile grid. */
  function assertBackOnGrid(expectedPath) {
    if (S.isDetailOpen()) throw new HaltError('Video overlay did not close; stopping to avoid acting on the wrong item.');
    if (location.pathname.replace(/\/$/, '') !== expectedPath.replace(/\/$/, '')) {
      throw new HaltError(`Page changed unexpectedly (now ${location.pathname}); stopping.`);
    }
    const tab = S.getRepostsTab();
    if (tab.found && tab.selected === false) throw new HaltError('Reposts tab is no longer selected; stopping.');
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------
  async function openDetail(item, settings) {
    const link = S.findItemLinkById(item.id); // fresh lookup: never reuse a stale element
    if (!link) return { ok: false, reason: 'no longer on the page' };
    link.scrollIntoView({ block: 'center', inline: 'nearest' });
    await sleep(400);
    const fresh = S.findItemLinkById(item.id);
    if (!fresh) return { ok: false, reason: 'disappeared after scrolling' };
    await domClick(fresh, `open repost ${item.id}`);
    const opened = await waitFor(() => S.getOpenDetailId() === item.id, T.openDetail);
    if (!opened) {
      if (S.isDetailOpen()) return { ok: false, reason: `a different video opened (${S.getOpenDetailId() || 'unknown'})` };
      return { ok: false, reason: 'video did not open (URL never showed its id)' };
    }
    await humanDelay(settings);
    assertNotBlocked();
    return { ok: true };
  }

  /** Set of "Repost" elements on screen right now (baseline for later comparison). */
  function repostBaseline() {
    return new Set(S.findRepostControls());
  }
  /** A "Repost" option that was NOT on screen when `baseline` was taken. */
  function newRepostSince(baseline) {
    return S.findRepostControls().find((el) => !baseline.has(el)) || null;
  }

  /**
   * Opens the share menu. Returns { btn, newRepost } where newRepost is true when
   * the menu that appeared offers "Repost" (i.e. NOT reposted by you). btn is null
   * when no share button exists.
   */
  async function openShareMenu() {
    const btn = S.findShareButton();
    if (!btn) return { btn: null, newRepost: false };
    if (S.findRemoveRepostControl()) return { btn, newRepost: false }; // already open
    const baseline = repostBaseline();
    const menuReady = () => S.findRemoveRepostControl() || newRepostSince(baseline);
    // Some TikTok layouts open the share menu on hover, others on click.
    await checkpoint();
    hover(btn);
    if (!(await waitFor(menuReady, T.menuHover))) {
      await domClick(btn, 'Share');
      await waitFor(menuReady, T.menuClick);
    }
    return { btn, newRepost: !S.findRemoveRepostControl() && !!newRepostSince(baseline) };
  }

  async function closeDetail(profilePath) {
    if (!S.isDetailOpen()) return true;
    const btn = S.findCloseButton();
    if (btn) {
      try {
        await domClick(btn, 'Close video');
      } catch (e) {
        if (e instanceof StopError) throw e;
      }
      if (await waitFor(() => !S.isDetailOpen(), T.closeDetail)) return true;
    }
    await checkpoint();
    pressEscape();
    if (await waitFor(() => !S.isDetailOpen(), T.closeDetail)) return true;
    // Last resort: history.back(), but ONLY if the overlay was pushed on top of
    // the profile URL we started from (so "back" returns to the profile).
    if (S.getOpenDetailId() && profilePath && history.length > 1) {
      await checkpoint();
      log('warn', 'Close button/Escape did not work; using browser Back.');
      history.back();
      if (await waitFor(() => !S.isDetailOpen(), T.closeDetail)) return true;
    }
    return false;
  }

  /**
   * Verify that the repost is gone. Returns { ok, how } or { ok:false, reason }.
   * NOTE: never clicks anything that says "Repost" (that would re-repost).
   */
  async function verifyRemoved(removeEl, shareBtn, preClickReposts) {
    let toast = false;
    let flipped = false; // menu option turned into "Repost" without closing
    const settled = await waitFor(() => {
      if (S.findRemovedToast()) toast = true;
      if (!S.findRemoveRepostControl() && newRepostSince(preClickReposts)) flipped = true;
      return toast || flipped || !S.stillRemoveRepost(removeEl);
    }, T.verify);
    // A blocker right after the click must stop the run, but the click already
    // happened, so report what we know (the caller records it, then halts).
    const blocker = S.detectBlocker();
    if (blocker) {
      const halt = `TikTok protection detected — stopped immediately. ${blocker}`;
      return toast ? { ok: true, how: 'TikTok confirmation toast', halt } : { ok: false, reason: 'blocked right after clicking (unverified)', halt };
    }
    if (toast) return { ok: true, how: 'TikTok confirmation toast' };
    if (flipped) return { ok: true, how: 'menu option changed to "Repost"' };
    if (!settled) return { ok: false, reason: '"Remove repost" is still showing after clicking it (unverified)' };

    // The menu closed without a toast: re-open it. After a successful removal it
    // must offer "Repost", not "Remove repost".
    if (shareBtn && shareBtn.isConnected) unhover(shareBtn);
    await sleep(600);
    const m = await openShareMenu();
    if (S.findRemovedToast()) return { ok: true, how: 'TikTok confirmation toast (late)' };
    if (S.findRemoveRepostControl()) return { ok: false, reason: '"Remove repost" is still offered after clicking it' };
    if (m.newRepost) {
      unhover(m.btn);
      return { ok: true, how: 're-opened menu now offers "Repost"' };
    }
    return { ok: false, reason: 'menu could not be re-opened to confirm (unverified)' };
  }

  /** Process ONE repost. Returns { result: 'removed'|'identified'|'skipped'|'failed', reason } */
  async function processItem(item, settings, profilePath) {
    const opened = await openDetail(item, settings);
    if (!opened.ok) {
      await closeDetail(profilePath);
      return { result: 'skipped', reason: opened.reason };
    }

    const menu = await openShareMenu();
    const shareBtn = menu.btn;
    if (!shareBtn) {
      return { result: 'skipped', reason: 'Share button not found in video view' };
    }

    const removeEl = S.findRemoveRepostControl();
    if (!removeEl) {
      if (menu.newRepost) return { result: 'skipped', reason: 'menu shows "Repost", not "Remove repost" (not reposted by you?)' };
      return { result: 'skipped', reason: '"Remove repost" option not found in share menu' };
    }

    if (settings.dryRun) {
      return { result: 'identified', reason: 'DRY RUN — found "Remove repost"; did NOT click it' };
    }

    await humanDelay(settings);
    assertNotBlocked();

    // Final safety re-checks right before the one destructive click:
    //  - still the same video (guards against the overlay changing under us)
    //  - the element is still attached, visible and still says exactly "Remove repost"
    if (S.getOpenDetailId() !== item.id) return { result: 'skipped', reason: 'open video changed before clicking' };
    let target = removeEl;
    if (!S.stillRemoveRepost(target)) {
      target = S.findRemoveRepostControl(); // menu may have re-rendered; re-find, never guess
      if (!target) return { result: 'skipped', reason: '"Remove repost" vanished before clicking' };
    }

    const preClickReposts = repostBaseline();
    await domClick(target, 'Remove repost');
    log('info', `Clicked "Remove repost" on ${item.id}; verifying…`);
    const v = await verifyRemoved(target, shareBtn, preClickReposts);
    if (v.ok) return { result: 'removed', reason: `verified via ${v.how}`, halt: v.halt };
    return { result: 'failed', reason: v.reason, halt: v.halt };
  }

  /** Scroll to load more grid items. Returns true if new (unseen) ids appeared. */
  async function loadMore(seen) {
    // "Grew" means an id we have NEVER processed appeared. Re-rendered (virtualized)
    // items we already handled do not count, so this can't loop on the same items.
    const hasUnseen = () => S.collectRepostItems().some((i) => !seen.has(i.id));
    const se = document.scrollingElement || document.documentElement;
    // Nudge up first so scroll/IntersectionObserver-based loaders see a fresh
    // "reached the bottom" transition, even if we were already at the bottom.
    await checkpoint();
    window.scrollBy({ top: -Math.round(window.innerHeight / 2), behavior: 'auto' });
    await sleep(300);
    const items = S.collectRepostItems();
    if (items.length) items[items.length - 1].link.scrollIntoView({ block: 'end' });
    window.scrollTo({ top: se.scrollHeight, behavior: 'auto' });
    // When removed tiles vanish, the page can become shorter than the window and
    // no real scroll event fires; dispatch one so scroll-listener loaders run.
    window.dispatchEvent(new Event('scroll'));
    const grew = await waitFor(hasUnseen, T.loadMore);
    if (!grew && S.isLoadingMore()) {
      // Still spinning: give it one more window.
      return !!(await waitFor(hasUnseen, T.loadMore));
    }
    return !!grew;
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  async function run(settings, myCtl) {
    const seen = new Set();
    let consecutiveProblems = 0;
    let emptyScrolls = 0;
    const profilePath = location.pathname;
    // Hard upper bound on loop iterations so a broken page can never spin forever.
    const maxIterations = settings.maxActions * 4 + 50;
    const isDryList = settings.dryRun && settings.dryRunDepth === 'list';

    try {
      preflight(settings);
      for (let iter = 0; ; iter++) {
        await checkpoint();
        if (iter >= maxIterations) throw new HaltError('Safety limit on loop iterations reached; stopping.');
        if (state.processed >= settings.maxActions) {
          finish('done', `Reached the max-actions limit (${settings.maxActions}). Start again to continue.`);
          return;
        }
        assertNotBlocked();

        const next = S.collectRepostItems().find((i) => !seen.has(i.id));
        if (!next) {
          if (emptyScrolls >= T.maxEmptyScrolls) {
            finish('done', `No more unprocessed reposts found after scrolling. Processed ${state.processed}. ` + 'Refresh the page to confirm the list is empty.');
            return;
          }
          setStatus('running', 'Scrolling to load more reposts…');
          const grew = await loadMore(seen);
          emptyScrolls = grew ? 0 : emptyScrolls + 1;
          if (!grew) log('info', `Nothing new loaded (attempt ${emptyScrolls}/${T.maxEmptyScrolls}).`);
          await humanDelay(settings, 0.5);
          continue;
        }

        emptyScrolls = 0;
        seen.add(next.id); // mark BEFORE processing: an item is never attempted twice
        state.processed++;
        setStatus('running', `Processing ${state.processed}/${settings.maxActions}: ${next.id}`);

        let outcome;
        if (isDryList) {
          outcome = { result: 'identified', reason: `DRY RUN (list only) — would open ${next.href} and click "Remove repost"` };
          record(next, outcome);
        } else {
          try {
            outcome = await processItem(next, settings, profilePath);
          } catch (e) {
            if (e instanceof StopError || e instanceof HaltError) throw e;
            outcome = { result: 'failed', reason: `error: ${e && e.message ? e.message : e}` };
          }
          // Record BEFORE anything else can halt the run, so counters never miss
          // a removal that already happened.
          record(next, outcome);
          // Blocked mid-item: stop without touching the page again.
          if (outcome.halt) throw new HaltError(outcome.halt);
          // Always try to return to the grid, whatever happened.
          if (!(await closeDetail(profilePath))) {
            throw new HaltError('Could not close the video overlay; stopping to avoid acting on the wrong item.');
          }
          await sleep(500);
          assertBackOnGrid(profilePath);
        }

        if (outcome.result === 'removed' || outcome.result === 'identified') {
          consecutiveProblems = 0;
        } else if (++consecutiveProblems >= settings.maxConsecutiveProblems) {
          consecutiveProblems = 0;
          myCtl.paused = true;
          setStatus('paused', `Auto-paused: ${settings.maxConsecutiveProblems} problems in a row. ` + 'Check the log/selectors, then Resume or Stop.');
          log('warn', 'Auto-paused after repeated skips/failures — the page structure may have changed.');
        }

        await humanDelay(settings, isDryList ? 0.25 : 1);
      }
    } catch (e) {
      if (e instanceof StopError) {
        finish('stopped', 'Stopped by you. No further actions will be taken.');
      } else if (e instanceof HaltError) {
        finish('halted', e.message);
      } else {
        console.error(e);
        finish('error', `Unexpected error: ${e && e.message ? e.message : e}`);
      }
    }
  }

  function record(item, outcome) {
    const { result, reason } = outcome;
    if (result === 'removed') {
      state.removed++;
      log('success', `Removed repost ${item.id} (${reason}).`);
    } else if (result === 'identified') {
      state.identified++;
      log('info', `${reason} [${item.id}]`);
    } else if (result === 'skipped') {
      state.skipped++;
      log('warn', `Skipped ${item.id}: ${reason}.`);
    } else {
      state.failed++;
      log('error', `Failed ${item.id}: ${reason}.`);
    }
  }

  function finish(status, message) {
    log(status === 'done' ? 'success' : status === 'stopped' ? 'warn' : 'error', message);
    setStatus(status, message);
  }

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  function start(rawSettings) {
    if (runPromise) return { ok: false, error: `Already ${state.status}. Stop it first.` };
    const settings = sanitizeSettings(rawSettings);
    const myCtl = { abort: new AbortController(), paused: false, waiters: [], runId: ++runCounter };
    ctl = myCtl;
    overlayHidden = false;
    Object.assign(state, {
      removed: 0,
      identified: 0,
      skipped: 0,
      failed: 0,
      processed: 0,
      dryRun: settings.dryRun,
      dryRunDepth: settings.dryRunDepth,
      startedAt: Date.now(),
    });
    log('info', `Starting${settings.dryRun ? ` DRY RUN (${settings.dryRunDepth})` : ''}: delay ${settings.minDelaySec}–${settings.maxDelaySec}s, max ${settings.maxActions} reposts.`);
    setStatus('running', 'Starting…');
    runPromise = run(settings, myCtl).finally(() => {
      if (ctl === myCtl) ctl = null;
      runPromise = null;
      broadcast();
    });
    return { ok: true };
  }

  function pause() {
    if (!ctl || state.status !== 'running') return { ok: false, error: 'Not running.' };
    ctl.paused = true;
    setStatus('paused', 'Paused. Current step will wait; press Resume or Stop.');
    log('info', 'Paused.');
    return { ok: true };
  }

  function resume() {
    if (!ctl || state.status !== 'paused') return { ok: false, error: 'Not paused.' };
    try {
      assertNotBlocked();
    } catch (e) {
      return { ok: false, error: e.message };
    }
    ctl.paused = false;
    const w = ctl.waiters.splice(0);
    w.forEach((fn) => fn());
    setStatus('running', 'Resumed.');
    log('info', 'Resumed.');
    return { ok: true };
  }

  function stop() {
    if (!ctl) return { ok: false, error: 'Nothing is running.' };
    setStatus('stopping', 'Stopping…');
    ctl.abort.abort(); // rejects every pending sleep/wait instantly
    return { ok: true };
  }

  function diagnose() {
    const tab = S.getRepostsTab();
    const items = S.collectRepostItems();
    const share = S.findShareButton();
    const info = {
      url: location.href,
      isProfilePage: S.isProfilePath(),
      handle: S.profileHandle(),
      loggedOut: S.isLoggedOut(),
      blocker: S.detectBlocker(),
      ownProfile: !!S.findEditProfile(),
      repostsTabFound: tab.found,
      repostsTabSelected: tab.selected,
      gridContainer: !!S.getItemList(),
      visibleItems: items.length,
      sampleIds: items.slice(0, 5).map((i) => i.id),
      detailOpenId: S.getOpenDetailId(),
      shareButton: share ? describe(share) : null,
      removeRepostControl: (() => {
        const r = S.findRemoveRepostControl();
        return r ? describe(r) : null;
      })(),
      repostControls: S.findRepostControls().map(describe),
      closeButton: (() => {
        const c = S.findCloseButton();
        return c ? describe(c) : null;
      })(),
    };
    log('info', 'Diagnose: ' + JSON.stringify(info));
    console.table(info);
    return info;
  }

  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const e2e = el.getAttribute('data-e2e');
    const role = el.getAttribute('role');
    const label = el.getAttribute('aria-label');
    return `<${tag}${e2e ? ` data-e2e="${e2e}"` : ''}${role ? ` role="${role}"` : ''}${label ? ` aria-label="${label}"` : ''}> "${S.normText(el.innerText).slice(0, 40)}"`;
  }

  // ---------------------------------------------------------------------------
  // On-page overlay (closed Shadow DOM so TikTok selectors never see its text)
  // ---------------------------------------------------------------------------
  let overlay = null;
  let overlayHidden = false; // user clicked ✕; reset on every Start
  function ensureOverlay() {
    if (overlay) return overlay;
    const host = document.createElement('div');
    host.id = S.OWN_UI_ID;
    host.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        .box{font:12px/1.4 system-ui,sans-serif;background:#111;color:#eee;border:1px solid #444;border-radius:8px;
             padding:8px 10px;width:250px;box-shadow:0 4px 16px rgba(0,0,0,.4)}
        .row{display:flex;gap:6px;align-items:center;justify-content:space-between}
        .title{font-weight:600}
        .msg{margin:4px 0;color:#ccc;word-break:break-word;max-height:4.2em;overflow:hidden}
        .counts{color:#aaa}
        button{font:inherit;border:1px solid #555;background:#222;color:#eee;border-radius:4px;padding:2px 8px;cursor:pointer}
        button:disabled{opacity:.4;cursor:default}
        .stop{background:#7a1010;border-color:#a33}
        .pill{font-size:11px;padding:0 6px;border-radius:9px;background:#333}
        .dry{color:#ffd166}
        .x{background:none;border:none;color:#888;padding:0 2px}
      </style>
      <div class="box">
        <div class="row"><span class="title">Repost Remover <span class="dry"></span></span><span class="pill"></span><button class="x" title="Hide">✕</button></div>
        <div class="msg"></div>
        <div class="counts"></div>
        <div class="row" style="margin-top:6px">
          <button data-a="pause">Pause</button><button data-a="resume">Resume</button><button data-a="stop" class="stop">Stop</button>
        </div>
      </div>`;
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.classList.contains('x')) {
        overlayHidden = true;
        host.style.display = 'none';
        return;
      }
      const a = b.getAttribute('data-a');
      if (a === 'pause') pause();
      else if (a === 'resume') {
        const r = resume();
        if (!r.ok) log('warn', r.error);
      } else if (a === 'stop') stop();
    });
    document.getElementById(S.OWN_UI_ID)?.remove(); // panel left by an orphaned copy
    (document.body || document.documentElement).appendChild(host);
    overlay = {
      host,
      pill: root.querySelector('.pill'),
      dry: root.querySelector('.dry'),
      msg: root.querySelector('.msg'),
      counts: root.querySelector('.counts'),
      pause: root.querySelector('[data-a="pause"]'),
      resume: root.querySelector('[data-a="resume"]'),
      stop: root.querySelector('[data-a="stop"]'),
    };
    return overlay;
  }

  function renderOverlay() {
    if (state.status === 'idle' && !overlay) return;
    const o = ensureOverlay();
    if (!o.host.isConnected) (document.body || document.documentElement).appendChild(o.host);
    o.host.style.display = overlayHidden ? 'none' : '';
    o.pill.textContent = state.status;
    o.dry.textContent = state.dryRun ? '(DRY RUN)' : '';
    o.msg.textContent = state.message;
    o.counts.textContent = `${state.dryRun ? `would remove ${state.identified}` : `removed ${state.removed}`} · skipped ${state.skipped} · failed ${state.failed}`;
    o.pause.disabled = state.status !== 'running';
    o.resume.disabled = state.status !== 'paused';
    o.stop.disabled = !['running', 'paused'].includes(state.status);
  }

  // ---------------------------------------------------------------------------
  // Messaging with popup / background
  // ---------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('trr:')) return false;
    let res;
    try {
      switch (msg.type) {
        case 'trr:ping':
          res = { ok: true };
          break;
        case 'trr:getState':
          res = { ok: true, state: snapshot() };
          break;
        case 'trr:start':
          res = start(msg.settings);
          break;
        case 'trr:pause':
          res = pause();
          break;
        case 'trr:resume':
          res = resume();
          break;
        case 'trr:stop':
          res = stop();
          break;
        case 'trr:diagnose':
          res = { ok: true, info: diagnose() };
          break;
        case 'trr:clearLog':
          state.log = [];
          broadcast();
          res = { ok: true };
          break;
        default:
          return false;
      }
    } catch (e) {
      res = { ok: false, error: String(e && e.message ? e.message : e) };
    }
    sendResponse(Object.assign({ state: snapshot() }, res));
    return false;
  });

  // Stop if the user navigates away from the profile by a full page unload.
  window.addEventListener('pagehide', () => {
    if (ctl) ctl.abort.abort();
  });

  // Exposed for debugging from DevTools (select the extension's context in the
  // Console dropdown): TRR.diagnose(), TRR_SEL.collectRepostItems(), …
  function isAlive() {
    try {
      return !!chrome.runtime?.id;
    } catch (_) {
      return false;
    }
  }
  globalThis.TRR = Object.freeze({ diagnose, start, pause, resume, stop, snapshot, isAlive, DEFAULT_SETTINGS });
})();
