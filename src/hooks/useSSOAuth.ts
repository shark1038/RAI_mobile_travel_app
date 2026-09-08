import { useCallback, useState } from "react";
import { useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as Sentry from "@sentry/react-native";

type SSOStrategy = "oauth_google" | "oauth_apple";

/**
 * Wraps Clerk's `useSSO` for browser-based OAuth (Google / Apple).
 *
 * Combined sign-in-or-up: Clerk's SSO flow creates a session for both new and
 * returning users, so a single entry point covers both. `useSSO` also handles
 * the `transferable` / `session_exists` cases internally — we only react to the
 * resulting `createdSessionId`.
 */
export function useSSOAuth() {
  const { startSSOFlow } = useSSO();
  const [pendingStrategy, setPendingStrategy] = useState<SSOStrategy | null>(null);

  const signInWith = useCallback(
    async (strategy: SSOStrategy) => {
      if (pendingStrategy) return;
      setPendingStrategy(strategy);
      try {
        // Trace the full OAuth round-trip so sign-in latency is measurable in
        // production (browser hand-off + Clerk session activation).
        await Sentry.startSpan(
          { name: "SSO sign-in", op: "auth.signin", attributes: { strategy } },
          async () => {
            const { createdSessionId, setActive } = await startSSOFlow({
              strategy,
              redirectUrl: AuthSession.makeRedirectUri(),
            });

            // On success Clerk returns a session id; activating it signs the user in.
            if (createdSessionId && setActive) {
              await setActive({ session: createdSessionId });
              Sentry.logger.info("User signed in", { strategy });
            }
            // No session id => the user cancelled/dismissed the browser. Non-fatal.
          },
        );
      } catch (err) {
        // Only real errors land here; surface for debugging without crashing UI.
        Sentry.logger.error("SSO sign-in failed", {
          strategy,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setPendingStrategy(null);
      }
    },
    [startSSOFlow, pendingStrategy],
  );

  return { signInWith, pendingStrategy };
}
