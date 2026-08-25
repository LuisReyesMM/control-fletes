import {
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  router,
  type Href,
} from "expo-router";

import {
  supabase,
} from "../lib/supabase";

const DASHBOARD_ROUTE =
  "/dashboard" as Href;

export default function LoginScreen() {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  async function signIn() {
    if (
      !email.trim() ||
      !password
    ) {
      Alert.alert(
        "Datos incompletos",
        "Escribe tu correo y contraseña."
      );

      return;
    }

    try {
      setLoading(true);

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              email
                .trim()
                .toLowerCase(),

            password,
          }
        );

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "No fue posible iniciar sesión."
        );
      }

      const {
        data:
          profile,

        error:
          profileError,
      } =
        await supabase
          .from("profiles")
          .select(
            "role, active"
          )
          .eq(
            "id",
            data.user.id
          )
          .single();

      if (
        profileError ||
        !profile
      ) {
        await supabase.auth.signOut();

        throw new Error(
          "No se encontró tu perfil."
        );
      }

      if (
        !profile.active
      ) {
        await supabase.auth.signOut();

        throw new Error(
          "Tu cuenta está desactivada."
        );
      }

      router.replace(
        DASHBOARD_ROUTE
      );
    } catch (error) {
      Alert.alert(
        "No se pudo iniciar sesión",
        error instanceof Error
          ? error.message
          : "Ocurrió un error."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS ===
        "ios"
          ? "padding"
          : undefined
      }
    >
      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          Control de Fletes
        </Text>

        <Text
          style={
            styles.title
          }
        >
          Iniciar sesión
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Accede con tu cuenta del
          sistema.
        </Text>

        <Text
          style={
            styles.label
          }
        >
          Correo
        </Text>

        <TextInput
          value={email}
          onChangeText={
            setEmail
          }
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="correo@empresa.com"
          placeholderTextColor="#94a3b8"
          style={
            styles.input
          }
        />

        <Text
          style={
            styles.label
          }
        >
          Contraseña
        </Text>

        <TextInput
          value={
            password
          }
          onChangeText={
            setPassword
          }
          secureTextEntry
          placeholder="Contraseña"
          placeholderTextColor="#94a3b8"
          style={
            styles.input
          }
        />

        <Pressable
          disabled={
            loading
          }
          onPress={() =>
            void signIn()
          }
          style={({
            pressed,
          }) => [
            styles.button,

            pressed &&
              styles.buttonPressed,

            loading &&
              styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text
              style={
                styles.buttonText
              }
            >
              Entrar
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      justifyContent:
        "center",

      padding: 24,

      backgroundColor:
        "#f8fafc",
    },

    card: {
      borderRadius: 24,

      backgroundColor:
        "#ffffff",

      padding: 24,

      shadowColor:
        "#000000",

      shadowOpacity:
        0.08,

      shadowRadius: 18,

      shadowOffset: {
        width: 0,
        height: 6,
      },

      elevation: 4,
    },

    eyebrow: {
      color:
        "#2563eb",

      fontSize: 14,

      fontWeight:
        "600",
    },

    title: {
      marginTop: 6,

      fontSize: 30,

      fontWeight:
        "800",

      color:
        "#0f172a",
    },

    subtitle: {
      marginTop: 8,

      marginBottom: 24,

      color:
        "#64748b",

      fontSize: 15,
    },

    label: {
      marginBottom: 7,

      marginTop: 12,

      color:
        "#334155",

      fontSize: 14,

      fontWeight:
        "600",
    },

    input: {
      height: 50,

      borderWidth: 1,

      borderColor:
        "#cbd5e1",

      borderRadius: 14,

      paddingHorizontal:
        14,

      backgroundColor:
        "#ffffff",

      color:
        "#0f172a",

      fontSize: 16,
    },

    button: {
      height: 52,

      marginTop: 26,

      borderRadius: 14,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#0f172a",
    },

    buttonPressed: {
      opacity: 0.85,
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    buttonText: {
      color:
        "#ffffff",

      fontSize: 16,

      fontWeight:
        "700",
    },
  });