import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TIMEOUT_MS,
  SESSION_ACTIVITY_KEY,
  SESSION_USER_KEY,
  SESSION_EXPIRED_KEY,
  recordUserActivity,
  getLastActivityTime,
  isSessionExpired,
  clearUserSession,
  markSessionExpired,
  consumeSessionExpiredReason,
} from "../src/lib/sessionTimeout.ts";

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

test("SESSION_TIMEOUT_MS equals exactly 2 hours in milliseconds", () => {
  assert.equal(SESSION_TIMEOUT_MS, 2 * 60 * 60 * 1000);
  assert.equal(SESSION_TIMEOUT_MS, 7200000);
});

test("recordUserActivity stores current timestamp and user UID in localStorage", () => {
  const mockLocal = createMockStorage();
  globalThis.window = { localStorage: mockLocal };

  const before = Date.now();
  recordUserActivity("user-123");
  const after = Date.now();

  const storedTime = getLastActivityTime();
  assert.ok(storedTime !== null);
  assert.ok(storedTime >= before && storedTime <= after);
  assert.equal(mockLocal.getItem(SESSION_USER_KEY), "user-123");
});

test("isSessionExpired returns false when activity is recent (< 2 hours)", () => {
  const mockLocal = createMockStorage();
  globalThis.window = { localStorage: mockLocal };

  // 1 hour and 50 minutes ago
  const recentTime = Date.now() - (110 * 60 * 1000);
  mockLocal.setItem(SESSION_ACTIVITY_KEY, String(recentTime));
  mockLocal.setItem(SESSION_USER_KEY, "user-abc");

  assert.equal(isSessionExpired("user-abc"), false);
});

test("isSessionExpired returns true when activity is older than 2 hours", () => {
  const mockLocal = createMockStorage();
  globalThis.window = { localStorage: mockLocal };

  // 2 hours and 1 minute ago
  const expiredTime = Date.now() - (121 * 60 * 1000);
  mockLocal.setItem(SESSION_ACTIVITY_KEY, String(expiredTime));
  mockLocal.setItem(SESSION_USER_KEY, "user-abc");

  assert.equal(isSessionExpired("user-abc"), true);
});

test("isSessionExpired returns false when no previous activity is recorded (fresh session)", () => {
  const mockLocal = createMockStorage();
  globalThis.window = { localStorage: mockLocal };

  assert.equal(isSessionExpired("user-abc"), false);
});

test("isSessionExpired resets and returns false if a different user UID is authenticated", () => {
  const mockLocal = createMockStorage();
  globalThis.window = { localStorage: mockLocal };

  // Old user session from 3 hours ago
  const oldTime = Date.now() - (180 * 60 * 1000);
  mockLocal.setItem(SESSION_ACTIVITY_KEY, String(oldTime));
  mockLocal.setItem(SESSION_USER_KEY, "user-old");

  // New user signs in
  assert.equal(isSessionExpired("user-new"), false);
});

test("clearUserSession wipes keys from localStorage", () => {
  const mockLocal = createMockStorage();
  globalThis.window = { localStorage: mockLocal };

  mockLocal.setItem(SESSION_ACTIVITY_KEY, "12345");
  mockLocal.setItem(SESSION_USER_KEY, "user-xyz");

  clearUserSession();

  assert.equal(mockLocal.getItem(SESSION_ACTIVITY_KEY), null);
  assert.equal(mockLocal.getItem(SESSION_USER_KEY), null);
});

test("markSessionExpired and consumeSessionExpiredReason work correctly", () => {
  const mockLocal = createMockStorage();
  const mockSession = createMockStorage();
  globalThis.window = {
    localStorage: mockLocal,
    sessionStorage: mockSession,
  };

  mockLocal.setItem(SESSION_ACTIVITY_KEY, "12345");
  markSessionExpired("inactivity_2h");

  // Session keys in localStorage should be cleared
  assert.equal(mockLocal.getItem(SESSION_ACTIVITY_KEY), null);

  // Reason should be available in sessionStorage once, then consumed
  const reason1 = consumeSessionExpiredReason();
  assert.equal(reason1, "inactivity_2h");

  const reason2 = consumeSessionExpiredReason();
  assert.equal(reason2, null);
});

