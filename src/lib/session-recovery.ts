type Session = { expires_at?: number; user: { id: string } };
type Failure = { message: string; code?: string };
type Auth = {
  getSession: () => Promise<{ data: { session: Session | null }; error: Failure | null }>;
  refreshSession: () => Promise<{ data: { session: Session | null }; error: Failure | null }>;
};

const sessionFailure = { message: "Votre session a expiré. Reconnectez-vous puis réessayez : votre saisie reste ouverte.", code: "SESSION_EXPIRED" };

/** Retry only an explicit expired-token rejection: never retry an uncertain write. */
export async function withSessionRecovery<T extends { error: Failure | null }>(
  auth: Auth,
  operation: () => PromiseLike<T>,
): Promise<T | { data: null; error: Failure }> {
  const initial = await auth.getSession();
  const session = initial.data.session;
  if (initial.error || !session) return { data: null, error: sessionFailure };
  const refresh = async () => {
    const result = await auth.refreshSession();
    return !result.error && result.data.session?.user.id === session.user.id;
  };
  let refreshed = false;
  if (!session.expires_at || session.expires_at * 1000 <= Date.now() + 60_000) {
    if (!await refresh()) return { data: null, error: sessionFailure };
    refreshed = true;
  }
  const result = await operation();
  const expired = result.error?.code === "PGRST301" && /jwt expired/i.test(result.error.message);
  if (!expired) return result;
  if (refreshed || !await refresh()) return { data: null, error: sessionFailure };
  const retry = await operation();
  if (retry.error?.code === "PGRST301" && /jwt expired/i.test(retry.error.message)) {
    return { data: null, error: sessionFailure };
  }
  return retry;
}