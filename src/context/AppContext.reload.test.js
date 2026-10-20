/**
 * Reload-path integration tests for AppProvider.
 *
 * These drive the exact auth-event order that @supabase/auth-js 2.116.0 emits
 * when a page is reloaded with a persisted session:
 *
 *   GoTrueClient._recoverAndRefresh()  -> _notifyAllSubscribers('SIGNED_IN')
 *   GoTrueClient._emitInitialSession() -> callback('INITIAL_SESSION')
 *
 * (see node_modules/@supabase/auth-js/dist/main/GoTrueClient.js lines 4165 and
 * 3657). AppContext's `schedule()` is a latest-wins debounce, so only one of
 * the two handlers actually runs - which one, and what it does, is what these
 * tests pin down.
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import {
  __emit,
  __emitterCount,
  __setGetUserResult,
  __setSession
} from '../config/supabase';

/* ------------------------------------------------------------------ mocks */

jest.mock('../config/supabase', () => {
  // State lives inside the factory: jest.mock is hoisted above the module
  // body, so the factory may not close over outer variables.
  const emitters = new Map();
  const state = { storedSession: null, getUserResult: null };

  return {
    SUPABASE_CONFIG_ERROR: null,
    SUPABASE_STORAGE_KEY: 'sb-test-auth-token',
    supabase: {
      auth: {
        onAuthStateChange: (callback) => {
          const id = `emitter-${emitters.size}-${Math.random()}`;
          emitters.set(id, callback);
          return { data: { subscription: { unsubscribe: () => emitters.delete(id) } } };
        },
        getSession: async () => ({ data: { session: state.storedSession }, error: null }),
        getUser: async () => {
          if (state.getUserResult) return state.getUserResult;
          return { data: { user: state.storedSession?.user || null }, error: null };
        },
        signOut: async () => { state.storedSession = null; return { error: null }; }
      },
      channel: () => {
        const chain = { on: () => chain, subscribe: () => chain };
        return chain;
      },
      removeChannel: () => {}
    },
    clearPersistedSession: jest.fn(),
    toCamelCase: (value) => value,
    // Test hooks, reached through the mocked module.
    __setSession: (session) => { state.storedSession = session; },
    __setGetUserResult: (result) => { state.getUserResult = result; },
    __emitterCount: () => emitters.size,
    __emit: (event, session) => {
      if (session !== undefined) state.storedSession = session;
      emitters.forEach((callback) => callback(event, session));
    }
  };
});

jest.mock('../services/authService', () => ({
  getCurrentUser: async () => global.__profile,
  isAccountApproved: (user) => Boolean(user) && user.isActive !== false,
  isRejectedAccount: (user) => user?.applicationStatus === 'REJECTED',
  logout: async () => ({ success: true }),
  syncAuthMarker: jest.fn()
}));

jest.mock('../services/supabaseService', () => {
  const empty = async () => [];
  return {
    getUsers: empty,
    getPrograms: empty,
    getOpportunities: empty,
    getApplications: empty,
    getOjtRecords: empty,
    getDailyReports: empty,
    getRequirements: empty,
    getCertificates: empty,
    getAnnouncements: empty,
    getNotifications: empty,
    getAttendanceLogs: empty,
    getOtRequests: empty,
    getSettings: async () => ({}),
    cleanupExpiredEvents: async () => {},
    isEventActive: () => true,
    getEventSlotState: () => ({ isFull: false, available: 1, total: 1 }),
    applicationReleasesSlot: () => true,
    isApprovedAccountStatus: () => true,
    normalizeRole: (role) => String(role || '').toUpperCase(),
    normalizeStatus: (status) => String(status || '').toUpperCase(),
    SAFE_USER_COLUMNS: '*'
  };
});

const PROFILE = {
  id: 'user-1',
  role: 'OJT/Intern',
  isActive: true,
  applicationStatus: 'APPROVED',
  fullName: 'Test Intern'
};

const SESSION = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'user-1', email: 'intern@example.com' }
};

function Probe() {
  const { state, authStatus } = useApp();
  return (
    <div data-testid="status">
      {authStatus}|{state.currentUser?.id || 'none'}
    </div>
  );
}

const mount = () => render(
  <AppProvider>
    <Probe />
  </AppProvider>
);

const status = () => screen.getByTestId('status').textContent;

const emit = (event, session) => __emit(event, session);
const emitterCount = () => __emitterCount();

beforeEach(() => {
  __setSession(SESSION);
  __setGetUserResult(null);
  global.__profile = PROFILE;
});

afterEach(cleanup);

/* ------------------------------------------------------------------ tests */

describe('AppProvider - session restore on reload', () => {
  test('a reload with a persisted session keeps the user signed in (SDK order: SIGNED_IN then INITIAL_SESSION)', async () => {
    mount();
    await waitFor(() => expect(emitterCount()).toBeGreaterThan(0));
    emit('SIGNED_IN', SESSION);
    emit('INITIAL_SESSION', SESSION);

    await waitFor(() => expect(status()).toBe('authenticated|user-1'));
  });

  test('the same reload works when the two init events arrive the other way round', async () => {
    mount();
    await waitFor(() => expect(emitterCount()).toBeGreaterThan(0));
    emit('INITIAL_SESSION', SESSION);
    emit('SIGNED_IN', SESSION);

    await waitFor(() => expect(status()).toBe('authenticated|user-1'));
  });

  test('a transient profile-read failure must NOT sign the user out', async () => {
    global.__profile = null; // profile read failed
    mount();
    await waitFor(() => expect(emitterCount()).toBeGreaterThan(0));
    emit('SIGNED_IN', SESSION);
    emit('INITIAL_SESSION', SESSION);

    // The session is still in storage, so the app must surface a retryable
    // error instead of ending the session.
    await waitFor(() => expect(status()).not.toBe('initializing|none'));
    expect(status()).toBe('error|none');
  });

  test('a reload whose session carries no readable user id must NOT sign the user out', async () => {
    // Mirrors auth-js's `userNotAvailableProxy()`: the stored session is intact
    // but `session.user.id` is not readable (GoTrueClient.js lines 4097-4111).
    // Before the fix this ended on `anonymous|none` - a silent logout on
    // reload. The identity must be recovered from the stored token instead.
    const userlessSession = { ...SESSION, user: { email: 'intern@example.com' } };
    __setSession(userlessSession);

    mount();
    await waitFor(() => expect(emitterCount()).toBeGreaterThan(0));
    emit('SIGNED_IN', userlessSession);
    emit('INITIAL_SESSION', userlessSession);

    await waitFor(() => expect(status()).toBe('authenticated|user-1'));
  });

  test('if the user id is unreadable AND the profile cannot be recovered, retry rather than log out', async () => {
    const userlessSession = { ...SESSION, user: { email: 'intern@example.com' } };
    __setSession(userlessSession);
    global.__profile = null;

    mount();
    await waitFor(() => expect(emitterCount()).toBeGreaterThan(0));
    emit('SIGNED_IN', userlessSession);
    emit('INITIAL_SESSION', userlessSession);

    // The token is still stored, so this must surface a retryable error and
    // keep the session, not silently end it.
    await waitFor(() => expect(status()).not.toBe('initializing|none'));
    expect(status()).toBe('error|none');
  });
});
