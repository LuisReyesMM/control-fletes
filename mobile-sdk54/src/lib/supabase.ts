import "react-native-url-polyfill/auto";

import {
  createClient,
  type Session,
} from "@supabase/supabase-js";

import * as SecureStore from "expo-secure-store";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}

const ExpoSecureStoreAdapter = {
  async getItem(
    key: string
  ) {
    return SecureStore.getItemAsync(
      key
    );
  },

  async setItem(
    key: string,
    value: string
  ) {
    await SecureStore.setItemAsync(
      key,
      value
    );
  },

  async removeItem(
    key: string
  ) {
    await SecureStore.deleteItemAsync(
      key
    );
  },
};

export const supabase =
  createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        storage:
          ExpoSecureStoreAdapter,

        autoRefreshToken:
          true,

        persistSession:
          true,

        detectSessionInUrl:
          false,
      },
    }
  );

function isSessionExpiring(
  session: Session
) {
  if (!session.expires_at) {
    return true;
  }

  const expiresAt =
    session.expires_at * 1000;

  const safetyMargin =
    60 * 1000;

  return (
    expiresAt -
      safetyMargin <=
    Date.now()
  );
}

export async function getFreshSession(): Promise<Session> {
  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  let session =
    data.session;

  if (!session) {
    throw new Error(
      "Tu sesión terminó. Inicia sesión nuevamente."
    );
  }

  if (
    isSessionExpiring(
      session
    )
  ) {
    const {
      data:
        refreshData,

      error:
        refreshError,
    } =
      await supabase.auth.refreshSession();

    if (
      refreshError ||
      !refreshData.session
    ) {
      await supabase.auth.signOut();

      throw new Error(
        "Tu sesión expiró. Inicia sesión nuevamente."
      );
    }

    session =
      refreshData.session;
  }

  return session;
}

export async function getFreshAccessToken() {
  const session =
    await getFreshSession();

  return session.access_token;
}