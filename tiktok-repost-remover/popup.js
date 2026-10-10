/*
 * popup.js — UI only. The popup closes whenever you click outside it, so it holds
 * no automation state; it just sends commands to content.js in the active TikTok tab
 * and renders the state that content.js reports back.
 */
'use strict';

const DEFAULT_SETTINGS = {
  minDelaySec: 2,
  maxDelaySec: 5,
  maxActions: 50,
  dryRun: true,
  dryRunDepth: 'inspect',
  maxConsecutiveProblems: 3,
  requireOwnProfile: true,
};

const $ = (id) => document.getElementById(id);
let tabId = null;
let lastState = null;
let liveConfirmTimer = null;

// ---------------------------------------------------------------------------
// Tab / content-script plumbing
// ---------------------------------------------------------------------------
async function getTikTokTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url is only visible for hosts we have permission for (tiktok.com), so an
  // undefined url simply means "not TikTok".
  if (!tab || !tab.url || !/^https:\/\/www\.tiktok\.com\//.test(tab.url)) return null;
  return tab;
}

async function send(msg) {
  return chrome.tabs.sendMessage(tabId, msg);
}

/** Make sure content.js is running in the tab (e.g. tab was open before install). */
async function ensureContentScript() {
  try {
    const r = await send({ type: 'trr:ping' });
    if (r && r.ok) return true;
  } catch (_) {
    /* not injected yet */
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['selectors.js', 'content.js'] });
    const r = await send({ type: 'trr:ping' });
    return !!(r && r.ok);
  } catch (e) {
    console.warn('inject failed', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return Object.assign({}, DEFAULT_SETTINGS, settings || {});
}

function fillForm(s) {
  $('dryRun').checked = !!s.dryRun;
  $('dryRunDepth').value = s.dryRunDepth;
  $('minDelaySec').value = s.minDelaySec;
  $('maxDelaySec').value = s.maxDelaySec;
  $('maxActions').value = s.maxActions;
  $('maxConsecutiveProblems').value = s.maxConsecutiveProblems;
  $('requireOwnProfile').checked = !!s.requireOwnProfile;
  updateStartLabel();
}

/** Read + validate the form. Returns { settings } or { error }. */
function readForm() {
  const s = {
    dryRun: $('dryRun').checked,
    dryRunDepth: $('dryRunDepth').value === 'list' ? 'list' : 'inspect',
    minDelaySec: Number($('minDelaySec').value),
    maxDelaySec: Number($('maxDelaySec').value),
    maxActions: Number($('maxActions').value),
    maxConsecutiveProblems: Number($('maxConsecutiveProblems').value),
    requireOwnProfile: $('requireOwnProfile').checked,
  };
  if (!Number.isFinite(s.minDelaySec) || s.minDelaySec < 0.2) return { error: 'Min delay must be at least 0.2 seconds.' };
  if (!Number.isFinite(s.maxDelaySec) || s.maxDelaySec < s.minDelaySec) return { error: 'Max delay must be ≥ min delay.' };
  if (s.maxDelaySec > 300) return { error: 'Max delay must be ≤ 300 seconds.' };
  if (!Number.isInteger(s.maxActions) || s.maxActions < 1 || s.maxActions > 5000) return { error: 'Max reposts must be a whole number 1–5000.' };
  if (!Number.isInteger(s.maxConsecutiveProblems) || s.maxConsecutiveProblems < 1 || s.maxConsecutiveProblems > 50) {
    return { error: 'Auto-pause threshold must be a whole number 1–50.' };
  }
  return { settings: s };
}

async function saveForm() {
  const r = readForm();
  if (r.settings) await chrome.storage.local.set({ settings: r.settings });
  updateStartLabel();
}

function updateStartLabel() {
  if (liveConfirmTimer) return;
  $('btnStart').textContent = $('dryRun').checked ? 'Start (dry run)' : 'Start Removing Reposts';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function showNotice(text) {
  $('notice').hidden = !text;
  $('notice').textContent = text || '';
}

function render(state) {
  if (!state) return;
  lastState = state;
  const status = state.status;
  $('statusPill').textContent = status + (state.dryRun && status !== 'idle' ? ' · dry run' : '');
  $('statusPill').className = 'pill ' + status;
  $('message').textContent = state.message;
  $('cRemoved').textContent = state.dryRun ? state.identified : state.removed;
  $('cRemovedLabel').textContent = state.dryRun ? 'Would remove' : 'Removed';
  $('cSkipped').textContent = state.skipped;
  $('cFailed').textContent = state.failed;
  $('cProcessed').textContent = state.processed;

  const active = ['running', 'paused', 'stopping'].includes(status);
  $('btnStart').disabled = active;
  $('btnPause').disabled = status !== 'running';
  $('btnResume').disabled = status !== 'paused';
  $('btnStop').disabled = !['running', 'paused'].includes(status);
  for (const el of $('settings').elements) el.disabled = active;

  const ol = $('log');
  const atBottom = ol.scrollTop + ol.clientHeight >= ol.scrollHeight - 4;
  ol.textContent = '';
  for (const e of state.log || []) {
    const li = document.createElement('li');
    li.className = e.level;
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = new Date(e.t).toLocaleTimeString();
    li.append(t, document.createTextNode(e.msg));
    ol.appendChild(li);
  }
  if (atBottom) ol.scrollTop = ol.scrollHeight;
}

function disableAll(reason) {
  for (const id of ['btnStart', 'btnPause', 'btnResume', 'btnStop', 'btnDiagnose']) $(id).disabled = true;
  $('message').textContent = reason;
  $('statusPill').textContent = 'unavailable';
}

async function refresh() {
  try {
    const r = await send({ type: 'trr:getState' });
    if (r && r.state) render(r.state);
  } catch (_) {
    disableAll('Lost connection to the TikTok tab. Reload the tab and reopen this popup.');
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function command(type, extra) {
  try {
    const r = await send(Object.assign({ type }, extra || {}));
    if (r && r.state) render(r.state);
    showNotice(r && !r.ok && r.error ? r.error : '');
    return r;
  } catch (e) {
    showNotice('Could not reach the TikTok tab: ' + (e && e.message ? e.message : e));
    return null;
  }
}

async function onStart() {
  const r = readForm();
  if (r.error) return showNotice(r.error);
  await chrome.storage.local.set({ settings: r.settings });

  // LIVE mode needs a second click within 5 s, so a stray click can't start deleting.
  if (!r.settings.dryRun && !liveConfirmTimer) {
    $('btnStart').textContent = 'Click again to confirm LIVE removal';
    liveConfirmTimer = setTimeout(() => {
      liveConfirmTimer = null;
      updateStartLabel();
    }, 5000);
    return;
  }
  if (liveConfirmTimer) {
    clearTimeout(liveConfirmTimer);
    liveConfirmTimer = null;
    updateStartLabel();
  }
  await command('trr:start', { settings: r.settings });
}

async function onCopy() {
  const lines = (lastState?.log || []).map((e) => `${new Date(e.t).toISOString()} [${e.level}] ${e.msg}`);
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    showNotice('Log copied to clipboard.');
  } catch (e) {
    showNotice('Copy failed: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  fillForm(await loadSettings());
  $('settings').addEventListener('change', saveForm);
  $('btnStart').addEventListener('click', onStart);
  $('btnPause').addEventListener('click', () => command('trr:pause'));
  $('btnResume').addEventListener('click', () => command('trr:resume'));
  $('btnStop').addEventListener('click', () => command('trr:stop'));
  $('btnDiagnose').addEventListener('click', () => command('trr:diagnose'));
  $('btnClear').addEventListener('click', () => command('trr:clearLog'));
  $('btnCopy').addEventListener('click', onCopy);

  const tab = await getTikTokTab();
  if (!tab) {
    disableAll('Open your TikTok profile (https://www.tiktok.com/@yourname) → Reposts tab in this tab, then open this popup again.');
    return;
  }
  tabId = tab.id;
  if (!(await ensureContentScript())) {
    disableAll('Could not connect to the TikTok tab. Reload the TikTok tab and try again.');
    return;
  }

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.type === 'trr:state' && sender.tab && sender.tab.id === tabId) render(msg.state);
    return false;
  });
  await refresh();
  setInterval(refresh, 1500); // backup in case a broadcast is missed
}

init().catch((e) => {
  console.error(e);
  showNotice('Popup error: ' + e.message);
});
