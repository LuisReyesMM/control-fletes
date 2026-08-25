import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  router,
  type Href,
} from "expo-router";

import {
  supabase,
} from "../lib/supabase";

const LOGIN_ROUTE =
  "/login" as Href;

const DASHBOARD_ROUTE =
  "/dashboard" as Href;

export default function IndexScreen() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (session) {
          router.replace(
            DASHBOARD_ROUTE
          );
        } else {
          router.replace(
            LOGIN_ROUTE
          );
        }
      } catch (error) {
        console.error(
          "Error comprobando sesión:",
          error
        );

        if (mounted) {
          router.replace(
            LOGIN_ROUTE
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (!loading) {
    return null;
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <ActivityIndicator
        size="large"
      />

      <Text
        style={
          styles.text
        }
      >
        Cargando...
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#f8fafc",
    },

    text: {
      marginTop: 12,

      color:
        "#64748b",
    },
  });