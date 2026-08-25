import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
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

type Role =
  | "reader"
  | "editor"
  | "superuser";

type Profile = {
  full_name:
    string | null;

  role: Role;

  active: boolean;
};

const LOGIN_ROUTE =
  "/login" as Href;

const FLETES_ROUTE =
  "/fletes" as Href;

export default function DashboardScreen() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const {
          data: {
            user,
          },

          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          router.replace(
            LOGIN_ROUTE
          );

          return;
        }

        const {
          data:
            profileData,

          error:
            profileError,
        } =
          await supabase
            .from(
              "profiles"
            )
            .select(
              `
              full_name,
              role,
              active
              `
            )
            .eq(
              "id",
              user.id
            )
            .single<Profile>();

        if (
          profileError ||
          !profileData ||
          !profileData.active
        ) {
          await supabase.auth.signOut();

          router.replace(
            LOGIN_ROUTE
          );

          return;
        }

        if (!mounted) {
          return;
        }

        setEmail(
          user.email ??
            ""
        );

        setProfile(
          profileData
        );
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo cargar el dashboard."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    try {
      await supabase.auth.signOut();

      router.replace(
        LOGIN_ROUTE
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo cerrar la sesión."
      );
    }
  }

  if (loading) {
    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          size="large"
        />
      </View>
    );
  }

  if (!profile) {
    return null;
  }

  const canEdit =
    profile.role ===
      "editor" ||
    profile.role ===
      "superuser";

  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
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
          Dashboard
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Bienvenido.
        </Text>

        <View
          style={
            styles.infoCard
          }
        >
          <Text
            style={
              styles.infoLabel
            }
          >
            USUARIO
          </Text>

          <Text
            style={
              styles.infoTitle
            }
          >
            {profile.full_name ||
              "Sin nombre"}
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            {email}
          </Text>
        </View>

        <View
          style={
            styles.infoCard
          }
        >
          <Text
            style={
              styles.infoLabel
            }
          >
            NIVEL DE ACCESO
          </Text>

          <Text
            style={
              styles.infoTitle
            }
          >
            {profile.role ===
            "superuser"
              ? "Superusuario"
              : profile.role ===
                  "editor"
                ? "Editor"
                : "Lector"}
          </Text>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          Módulos
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              FLETES_ROUTE
            )
          }
          style={({
            pressed,
          }) => [
            styles.moduleCard,

            pressed &&
              styles.cardPressed,
          ]}
        >
          <Text
            style={
              styles.moduleEyebrow
            }
          >
            Operación
          </Text>

          <Text
            style={
              styles.moduleTitle
            }
          >
            Relación de Fletes
          </Text>

          <Text
            style={
              styles.moduleText
            }
          >
            Consulta y administra los
            registros autorizados.
          </Text>

          {canEdit && (
            <Text
              style={
                styles.permission
              }
            >
              Tu cuenta tiene permisos
              de edición.
            </Text>
          )}
        </Pressable>

        {profile.role ===
          "superuser" && (
          <>
            <View
              style={
                styles.moduleCard
              }
            >
              <Text
                style={
                  styles.moduleEyebrow
                }
              >
                Administración
              </Text>

              <Text
                style={
                  styles.moduleTitle
                }
              >
                Gestión de usuarios
              </Text>

              <Text
                style={
                  styles.moduleText
                }
              >
                Próximamente en la app
                móvil.
              </Text>
            </View>

            <View
              style={
                styles.moduleCard
              }
            >
              <Text
                style={
                  styles.moduleEyebrow
                }
              >
                Administración
              </Text>

              <Text
                style={
                  styles.moduleTitle
                }
              >
                Auditoría
              </Text>

              <Text
                style={
                  styles.moduleText
                }
              >
                Próximamente en la app
                móvil.
              </Text>
            </View>
          </>
        )}

        <Pressable
          onPress={() =>
            void logout()
          }
          style={({
            pressed,
          }) => [
            styles.logoutButton,

            pressed &&
              styles.cardPressed,
          ]}
        >
          <Text
            style={
              styles.logoutText
            }
          >
            Cerrar sesión
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,

      backgroundColor:
        "#f8fafc",
    },

    container: {
      padding: 22,

      paddingBottom:
        50,
    },

    loading: {
      flex: 1,

      justifyContent:
        "center",

      alignItems:
        "center",

      backgroundColor:
        "#f8fafc",
    },

    eyebrow: {
      marginTop: 12,

      color:
        "#2563eb",

      fontSize: 14,

      fontWeight:
        "600",
    },

    title: {
      marginTop: 5,

      color:
        "#0f172a",

      fontSize: 32,

      fontWeight:
        "800",
    },

    subtitle: {
      marginTop: 4,

      marginBottom: 24,

      color:
        "#64748b",

      fontSize: 15,
    },

    infoCard: {
      marginBottom: 14,

      borderWidth: 1,

      borderColor:
        "#e2e8f0",

      borderRadius: 18,

      backgroundColor:
        "#ffffff",

      padding: 20,
    },

    infoLabel: {
      color:
        "#94a3b8",

      fontSize: 12,

      fontWeight:
        "700",
    },

    infoTitle: {
      marginTop: 8,

      color:
        "#0f172a",

      fontSize: 18,

      fontWeight:
        "700",
    },

    infoText: {
      marginTop: 5,

      color:
        "#64748b",
    },

    sectionTitle: {
      marginTop: 16,

      marginBottom:
        12,

      color:
        "#0f172a",

      fontSize: 21,

      fontWeight:
        "800",
    },

    moduleCard: {
      marginBottom: 14,

      borderWidth: 1,

      borderColor:
        "#e2e8f0",

      borderRadius: 18,

      backgroundColor:
        "#ffffff",

      padding: 20,
    },

    moduleEyebrow: {
      color:
        "#2563eb",

      fontSize: 13,

      fontWeight:
        "600",
    },

    moduleTitle: {
      marginTop: 6,

      color:
        "#0f172a",

      fontSize: 20,

      fontWeight:
        "800",
    },

    moduleText: {
      marginTop: 10,

      color:
        "#64748b",

      fontSize: 14,

      lineHeight: 21,
    },

    permission: {
      marginTop: 12,

      color:
        "#64748b",

      fontSize: 12,
    },

    logoutButton: {
      marginTop: 16,

      borderWidth: 1,

      borderColor:
        "#cbd5e1",

      borderRadius: 14,

      alignItems:
        "center",

      paddingVertical:
        14,

      backgroundColor:
        "#ffffff",
    },

    logoutText: {
      color:
        "#334155",

      fontSize: 15,

      fontWeight:
        "700",
    },

    cardPressed: {
      opacity: 0.75,
    },
  });