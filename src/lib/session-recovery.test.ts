import { describe, expect, test } from "bun:test";
import { withSessionRecovery } from "./session-recovery";

function setup(expires_at = Math.floor(Date.now() / 1000) + 3600) {
  let refreshes = 0;
  const auth = {
    getSession: async () => ({ data: { session: { expires_at, user: { id: "seller" } } }, error: null }),
    refreshSession: async () => { refreshes++; return { data: { session: { expires_at: expires_at + 3600, user: { id: "seller" } } }, error: null }; },
  };
  return { auth, refreshes: () => refreshes };
}

describe("sale session recovery", () => {
  test("refreshes an expired session before writing once", async () => {
    const s = setup(1); let writes = 0;
    const result = await withSessionRecovery(s.auth, async () => { writes++; expect(s.refreshes()).toBe(1); return { data: "sale", error: null }; });
    expect(result.data).toBe("sale"); expect(writes).toBe(1);
  });
  test("retries an explicit JWT expired rejection once", async () => {
    const s = setup(); let calls = 0;
    const result = await withSessionRecovery(s.auth, async () => ++calls === 1 ? { data: null, error: { code: "PGRST301", message: "JWT expired" } } : { data: "sale", error: null });
    expect(result.data).toBe("sale"); expect(calls).toBe(2); expect(s.refreshes()).toBe(1);
  });
  test("never retries an uncertain network failure", async () => {
    const s = setup(); let calls = 0;
    await withSessionRecovery(s.auth, async () => { calls++; return { error: { message: "Failed to fetch" } }; });
    expect(calls).toBe(1); expect(s.refreshes()).toBe(0);
  });
  test("does not write when refreshing fails", async () => {
    const s = setup(1); let calls = 0;
    s.auth.refreshSession = async () => { throw new Error("offline"); };
    // Auth SDK returns auth failures rather than throwing them.
    const auth = { ...s.auth, refreshSession: async () => ({ data: { session: null }, error: { message: "refresh token expired" } }) };
    const result = await withSessionRecovery(auth, async () => { calls++; return { error: null }; });
    expect(result.error?.code).toBe("SESSION_EXPIRED"); expect(calls).toBe(0);
  });
  test("never saves under a different refreshed identity", async () => {
    const s = setup(1); let calls = 0;
    const auth = { ...s.auth, refreshSession: async () => ({ data: { session: { user: { id: "other" } } }, error: null }) };
    const result = await withSessionRecovery(auth, async () => { calls++; return { error: null }; });
    expect(result.error?.code).toBe("SESSION_EXPIRED"); expect(calls).toBe(0);
  });
});