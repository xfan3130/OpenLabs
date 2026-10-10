/*
 * background.js — MV3 service worker.
 *
 * Deliberately tiny and stateless: MV3 service workers are killed when idle, so
 * the automation itself lives in content.js. This worker only:
 *   - stores default settings on install
 *   - mirrors run status onto the toolbar badge for the tab being automated
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

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: Object.assign({}, DEFAULT_SETTINGS, settings || {}) });
});

const BADGE_COLORS = {
  running: '#1f8f3a',
  paused: '#d98b00',
  stopping: '#b00020',
  stopped: '#b00020',
  halted: '#b00020',
  error: '#b00020',
  done: '#1f5fbf',
};

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'trr:state' || !sender.tab || sender.tab.id == null) return false;
  const s = msg.state || {};
  const tabId = sender.tab.id;
  const n = s.dryRun ? s.identified : s.removed;
  const text = s.status === 'idle' ? '' : s.status === 'halted' || s.status === 'error' ? '!' : String(n ?? '');
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (BADGE_COLORS[s.status]) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[s.status] }).catch(() => {});
  }
  return false;
});
