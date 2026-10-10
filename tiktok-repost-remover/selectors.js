/*
 * selectors.js — EVERY piece of TikTok-specific DOM knowledge lives in this file.
 *
 * When TikTok changes its web UI, this is the only file you should need to edit.
 * Lines marked  // [TIKTOK-SELECTOR]  are guesses about TikTok's markup and are the
 * first things to check (see README.md → "Debugging selectors").
 *
 * Strategy, in order of preference:
 *   1. data-e2e attributes  (TikTok's own test hooks; the most stable thing on the page)
 *   2. ARIA roles / aria-labels
 *   3. Exact visible text   (English UI; add translations in TEXT below)
 *   4. URL / href structure (/video/<id>, /photo/<id>)
 * Generated class names (e.g. "css-1abc23-DivItemContainer") are NEVER relied on alone;
 * at most they are used as a loose "[class*=…]" fallback for non-destructive detection.
 *
 * This file only DETECTS things. It never clicks. All clicking happens in content.js.
 */
(() => {
  'use strict';
  if (globalThis.TRR_SEL) return; // guard against double injection

  // ---------------------------------------------------------------------------
  // Text patterns. TikTok UI language must be English for these to match.
  // To support another language, add alternatives to the regexes, e.g.
  //   removeRepost: /^(remove repost|eliminar republicación)$/i
  // ---------------------------------------------------------------------------
  const TEXT = {
    // [TIKTOK-SELECTOR] Label of the profile tab that lists your reposts.
    repostsTab: /^reposts?$/i,
    // [TIKTOK-SELECTOR] Button shown only on YOUR OWN profile.
    editProfile: /^edit profile$/i,
    // [TIKTOK-SELECTOR] The ONLY control this extension ever clicks destructively.
    // Must be an EXACT, whole-string match so "Repost" can never match it.
    removeRepost: /^remove repost$/i,
    // [TIKTOK-SELECTOR] The option shown when a video is NOT reposted by you.
    // Used only to VERIFY a removal. It is NEVER clicked (clicking it would re-repost).
    repost: /^repost$/i,
    // [TIKTOK-SELECTOR] Confirmation toast after removing a repost.
    removedToast: /(repost(s)? (was |has been )?removed|removed (from )?(your )?repost|unreposted|repost deleted)/i,
    // [TIKTOK-SELECTOR] Accessible name of the Share control in the video view.
    shareLabel: /^share\b/i,
    // [TIKTOK-SELECTOR] Accessible name of the "close video" control.
    closeLabel: /^close\b/i,
    // Any text matching one of these inside a dialog / toast / alert stops the run
    // immediately. Keep these broad: a false positive only stops the run (safe).
    blockers: [
      /verify to continue/i,
      /security (check|verification)/i,
      /complete the (security )?(check|verification|puzzle)/i,
      /drag the (slider|puzzle)/i,
      /slide to (verify|complete)/i,
      /select \d+ objects/i,
      /too many (requests|attempts)/i,
      /(you are|you're) (doing|tapping|visiting|going|moving) (that |this |things )?too fast/i,
      /try again later/i,
      /rate.?limit/i,
      /unusual (activity|traffic|behavior|behaviour)/i,
      /suspicious activity/i,
      /temporarily (blocked|restricted|banned|unavailable|limited)/i,
      /action (blocked|restricted|limited)/i,
      /(account|feature) (has been |is )?(restricted|suspended|limited)/i,
      /maximum number of/i,
      /couldn'?t (complete|process) (this|your) (action|request)/i,
    ],
  };

  // ---------------------------------------------------------------------------
  // CSS selectors. Each array is tried in order; the first visible match wins.
  // ---------------------------------------------------------------------------
  const SEL = {
    // [TIKTOK-SELECTOR] The "Reposts" tab on a profile page.
    repostsTab: ['[data-e2e="repost-tab"]', '[data-e2e="reposts-tab"]', '[data-e2e="user-repost-tab"]'],
    // Elements that may be profile tabs (used for the text-based fallback).
    tabCandidates: '[role="tab"], [data-e2e$="-tab"], [data-e2e*="tab"]',

    // [TIKTOK-SELECTOR] "Edit profile" button — proves this is YOUR profile.
    editProfile: ['[data-e2e="edit-profile-entrance"]', '[data-e2e="edit-profile"]', '[data-e2e="edit-profile-button"]'],

    // [TIKTOK-SELECTOR] Things that only exist when you are logged OUT.
    loggedOut: ['[data-e2e="top-login-button"]', '[data-e2e="login-modal"]', '#login-modal', '#loginContainer'],

    // [TIKTOK-SELECTOR] Grid containers / items in the profile video grid.
    itemList: ['[data-e2e="user-repost-item-list"]', '[data-e2e="repost-item-list"]', '[data-e2e="user-post-item-list"]'],
    item: ['[data-e2e="user-repost-item"]', '[data-e2e="repost-item"]', '[data-e2e="user-post-item"]'],
    // Links inside an item. TikTok reposts can be videos or photo posts.
    itemLink: 'a[href*="/video/"], a[href*="/photo/"]',

    // [TIKTOK-SELECTOR] Close button of the video "browse" overlay opened from a profile.
    // Its presence is also used as a signal that the overlay is open.
    close: ['[data-e2e="browse-close"]', '[data-e2e="video-detail-close"]'],

    // [TIKTOK-SELECTOR] Share button in the video overlay (opens the share menu
    // that contains "Repost" / "Remove repost").
    share: ['[data-e2e="browse-share-icon"]', '[data-e2e="share-icon"]', '[data-e2e="video-share-icon"]', '[data-e2e="share-button"]'],

    // Candidate elements for text matching of menu items.
    menuTextCandidates: 'button, [role="button"], [role="menuitem"], [role="option"], a, li, div, span, p',
    // Anything we would consider a real click target when climbing from a text node.
    clickable: 'button, [role="button"], [role="menuitem"], [role="option"], a[href], [tabindex]',

    // [TIKTOK-SELECTOR] Things that only exist inside the video overlay. Dialogs that
    // contain these are not scanned for blocker text (captions are user-written).
    videoOverlayMarkers: 'video, [data-e2e="browse-close"], [data-e2e="browse-share-icon"], [data-e2e="share-icon"], [data-e2e="video-detail-close"]',

    // Containers where blocker / toast text may appear.
    toasts: '[role="alert"], [role="status"], [aria-live="polite"], [aria-live="assertive"], [class*="toast" i], [class*="notice" i], [class*="snackbar" i]',
    dialogs: '[role="dialog"], [role="alertdialog"], [aria-modal="true"]',

    // [TIKTOK-SELECTOR] CAPTCHA / verification widgets. Any VISIBLE match stops the run.
    captcha: [
      '#captcha-verify-container',
      '#captcha_container',
      '.captcha_verify_container',
      '.captcha-verify-container',
      '[id*="captcha" i]',
      '[class*="captcha" i]',
      '[class*="secsdk" i]',
      'iframe[src*="captcha" i]',
      'iframe[src*="verify" i]',
    ],

    // [TIKTOK-SELECTOR] Loading spinners while the grid fetches more items.
    loading: ['[data-e2e="loading"]', '[role="progressbar"]', '[class*="Loading" i]', '[class*="spinner" i]'],
  };

  // Element id of our own on-page panel host; always excluded from searches.
  const OWN_UI_ID = 'trr-overlay-host';

  // ---------------------------------------------------------------------------
  // Generic DOM helpers (not TikTok-specific)
  // ---------------------------------------------------------------------------
  function isOwnUi(el) {
    return !!(el && el.closest && el.closest('#' + OWN_UI_ID));
  }

  function isVisible(el) {
    if (!el || !el.isConnected || isOwnUi(el)) return false;
    const cs0 = getComputedStyle(el);
    // display:contents elements (TikTok sometimes renders links this way) have no
    // box of their own — they are visible if any child is.
    if (cs0.display === 'contents') return Array.from(el.children).some(isVisible);
    const rects = el.getClientRects();
    if (!rects.length) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (cs0.visibility === 'hidden' || cs0.display === 'none' || Number(cs0.opacity) === 0) return false;
    return true;
  }

  /** Visible AND intersecting the viewport (off-screen preloaded videos are excluded). */
  function isOnScreen(el) {
    if (!isVisible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  }

  /** Of several on-screen candidates, the one whose centre is nearest the viewport centre. */
  function nearestToCenter(els) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let best = null;
    let bestD = Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    }
    return best;
  }

  /** First selector (in priority order) with an on-screen match; nearest-centre wins ties. */
  function firstOnScreen(selectors, root = document) {
    for (const s of [].concat(selectors)) {
      const hits = safeQueryAll(s, root).filter(isOnScreen);
      if (hits.length) return nearestToCenter(hits);
    }
    return null;
  }

  function safeQueryAll(selector, root = document) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (e) {
      console.warn('[TRR] bad selector', selector, e);
      return [];
    }
  }

  /** First visible element matching any selector in the list (tried in order). */
  function firstVisible(selectors, root = document) {
    for (const s of [].concat(selectors)) {
      const hit = safeQueryAll(s, root).find(isVisible);
      if (hit) return hit;
    }
    return null;
  }

  function normText(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  /** Accessible-ish name: aria-label, then title, then visible text. */
  function accName(el) {
    return normText(el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent);
  }

  /**
   * Visible elements whose WHOLE visible text (or aria-label) matches `regex`.
   * Returns the innermost matches (no element whose descendant also matches).
   */
  function findByExactText(regex, candidatesSelector, root = document, onScreenOnly = false) {
    const visible = onScreenOnly ? isOnScreen : isVisible;
    const hits = safeQueryAll(candidatesSelector, root).filter((el) => {
      // Cheap pre-filter on textContent / aria-label before touching layout.
      const tc = el.textContent || '';
      const label = normText(el.getAttribute('aria-label'));
      const textMaybe = tc.length <= 120 && regex.test(normText(tc));
      const labelMatch = !!label && regex.test(label);
      if (!textMaybe && !labelMatch) return false;
      if (!visible(el)) return false;
      if (textMaybe && regex.test(normText(el.innerText))) return true;
      return labelMatch;
    });
    // Keep only the innermost matches.
    return hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
  }

  /**
   * Climb from `el` to the nearest real click target, but only while the
   * ancestor's text is STILL an exact match — we never "click" a big container
   * that might contain other options.
   */
  function closestClickableSameText(el, regex, maxLevels = 4) {
    let cur = el;
    for (let i = 0; i <= maxLevels && cur && cur !== document.body; i++) {
      if (cur.matches && cur.matches(SEL.clickable)) {
        const t = normText(cur.innerText) || normText(cur.getAttribute('aria-label'));
        return regex.test(t) ? cur : el;
      }
      const parent = cur.parentElement;
      if (!parent) break;
      const pt = normText(parent.innerText);
      if (pt && !regex.test(pt)) break; // parent contains other text → stop climbing
      cur = parent;
    }
    return el;
  }

  /** Climb to the nearest clickable ancestor (used for non-destructive icons). */
  function closestClickable(el, maxLevels = 4) {
    let cur = el;
    for (let i = 0; i <= maxLevels && cur; i++) {
      if (cur.matches && cur.matches(SEL.clickable)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  // ---------------------------------------------------------------------------
  // URL helpers
  // ---------------------------------------------------------------------------
  // [TIKTOK-SELECTOR] Video/photo IDs are long numeric strings in the URL.
  const ID_RE = /\/(?:video|photo)\/(\d{6,})/;

  function idFromHref(href) {
    const m = ID_RE.exec(href || '');
    return m ? m[1] : null;
  }

  /** "/@handle" or "/@handle/" — a profile page (not a video page). */
  function isProfilePath(pathname = location.pathname) {
    return /^\/@[^/]+\/?$/.test(pathname);
  }

  function profileHandle(pathname = location.pathname) {
    const m = /^\/@([^/]+)/.exec(pathname);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // ---------------------------------------------------------------------------
  // TikTok UI detection
  // ---------------------------------------------------------------------------

  /** Returns a human-readable reason if TikTok is blocking/verifying us, else null. */
  function detectBlocker() {
    const cap = firstVisible(SEL.captcha);
    if (cap) return 'CAPTCHA / verification widget is visible on the page';

    const containers = safeQueryAll(SEL.toasts).concat(safeQueryAll(SEL.dialogs));
    for (const c of containers) {
      if (!isVisible(c)) continue;
      const t = normText(c.innerText);
      // Large dialogs are the video overlay itself (captions + comments). Scanning
      // those would cause false positives from user-written text, so skip them.
      if (!t || t.length > 600) continue;
      // The video overlay itself may be a dialog; its caption is user-written text.
      if (c.matches(SEL.dialogs) && c.querySelector(SEL.videoOverlayMarkers)) continue;
      for (const re of TEXT.blockers) {
        if (re.test(t)) return `TikTok says: "${t.slice(0, 160)}"`;
      }
    }
    return null;
  }

  function isLoggedOut() {
    return !!firstVisible(SEL.loggedOut);
  }

  /** Evidence that the open profile is the logged-in user's own profile. */
  function findEditProfile() {
    return (
      firstVisible(SEL.editProfile) ||
      findByExactText(TEXT.editProfile, 'button, [role="button"], a, div, span, p')[0] ||
      null
    );
  }

  /**
   * Finds the Reposts tab and whether it is selected.
   * selected: true / false when TikTok exposes it, null when it can't be determined.
   */
  function getRepostsTab() {
    let el = firstVisible(SEL.repostsTab);
    if (!el) {
      // Fallback: a tab-like element whose text is exactly "Reposts".
      el =
        findByExactText(TEXT.repostsTab, SEL.tabCandidates)[0] ||
        findByExactText(TEXT.repostsTab, 'p, span, div, button')[0] ||
        null;
    }
    if (!el) return { found: false, selected: null, el: null };

    // Look at the element and a few ancestors for a selection signal.
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      const sel = node.getAttribute && node.getAttribute('aria-selected');
      if (sel === 'true') return { found: true, selected: true, el };
      if (sel === 'false') return { found: true, selected: false, el };
      node = node.parentElement;
    }
    return { found: true, selected: null, el };
  }

  function getItemList() {
    return firstVisible(SEL.itemList);
  }

  /**
   * All visible repost items currently rendered, in DOM order, de-duplicated by id.
   * Returns [{ id, href, link }]. Elements are NOT cached by callers — always
   * re-query (TikTok re-renders the grid).
   */
  function collectRepostItems() {
    const out = [];
    const seen = new Set();
    const push = (link) => {
      if (!link || !isVisible(link)) return;
      const href = link.getAttribute('href') || '';
      const id = idFromHref(href);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ id, href, link });
    };

    // Preferred: data-e2e item containers.
    for (const s of SEL.item) {
      for (const item of safeQueryAll(s)) {
        if (!isVisible(item)) continue;
        push(item.matches(SEL.itemLink) ? item : item.querySelector(SEL.itemLink));
      }
      if (out.length) return out;
    }

    // Fallback: video/photo links inside the grid container, or inside <main>.
    const scope = getItemList() || document.querySelector('main') || document.body;
    for (const a of safeQueryAll(SEL.itemLink, scope)) push(a);
    return out;
  }

  function findItemLinkById(id) {
    return collectRepostItems().find((i) => i.id === id)?.link || null;
  }

  function isLoadingMore() {
    return !!firstVisible(SEL.loading, getItemList() || document);
  }

  /** ID of the video currently open in the overlay (from the URL), else null. */
  function getOpenDetailId() {
    return idFromHref(location.pathname);
  }

  function findCloseButton() {
    const direct = firstOnScreen(SEL.close);
    if (direct) return closestClickable(direct);
    const byLabel = safeQueryAll('button[aria-label], [role="button"][aria-label]').find(
      (el) => isOnScreen(el) && TEXT.closeLabel.test(normText(el.getAttribute('aria-label')))
    );
    return byLabel || null;
  }

  function isDetailOpen() {
    return getOpenDetailId() !== null || !!firstVisible(SEL.close);
  }

  function findShareButton() {
    // On-screen only: the overlay may keep neighbouring (preloaded) videos in the
    // DOM, and their share buttons must never be used for the open video.
    const direct = firstOnScreen(SEL.share);
    if (direct) return closestClickable(direct);
    // Fallback: a button whose accessible name starts with "Share", but never
    // anything mentioning "repost" (a separate repost toggle must not be touched).
    const byLabel = safeQueryAll('button, [role="button"]').filter((el) => {
      if (!isOnScreen(el)) return false;
      const n = accName(el);
      return TEXT.shareLabel.test(n) && !/repost/i.test(n);
    });
    return byLabel.length ? nearestToCenter(byLabel) : null;
  }

  /** The "Remove repost" menu item, or null. Exact text match only. */
  function findRemoveRepostControl() {
    const hits = findByExactText(TEXT.removeRepost, SEL.menuTextCandidates, document, true);
    if (!hits.length) return null;
    if (hits.length > 1) {
      // Several identical visible options is unexpected — use the one inside a
      // dialog/menu/popover if that disambiguates, otherwise refuse (null).
      const inMenu = hits.filter((h) => h.closest('[role="menu"], [role="dialog"], [role="listbox"], [class*="popover" i], [class*="share" i]'));
      if (inMenu.length !== 1) return null;
      return closestClickableSameText(inMenu[0], TEXT.removeRepost);
    }
    return closestClickableSameText(hits[0], TEXT.removeRepost);
  }

  /**
   * All on-screen plain "Repost" options (verification only — NEVER clicked).
   * Callers compare against a baseline taken earlier, so an unrelated "Repost"
   * button elsewhere on the page is not mistaken for the share-menu option.
   */
  function findRepostControls() {
    return findByExactText(TEXT.repost, SEL.menuTextCandidates, document, true);
  }

  function findRemovedToast() {
    return safeQueryAll(SEL.toasts).some((el) => isVisible(el) && TEXT.removedToast.test(normText(el.innerText)));
  }

  /** Is this element still the exact "Remove repost" control and on screen? */
  function stillRemoveRepost(el) {
    return !!el && isOnScreen(el) && TEXT.removeRepost.test(accName(el) || normText(el.innerText));
  }

  globalThis.TRR_SEL = Object.freeze({
    TEXT,
    SEL,
    OWN_UI_ID,
    // helpers
    isVisible,
    isOnScreen,
    firstVisible,
    normText,
    accName,
    findByExactText,
    idFromHref,
    isProfilePath,
    profileHandle,
    // detection
    detectBlocker,
    isLoggedOut,
    findEditProfile,
    getRepostsTab,
    getItemList,
    collectRepostItems,
    findItemLinkById,
    isLoadingMore,
    getOpenDetailId,
    isDetailOpen,
    findCloseButton,
    findShareButton,
    findRemoveRepostControl,
    findRepostControls,
    findRemovedToast,
    stillRemoveRepost,
  });
})();
