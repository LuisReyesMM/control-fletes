import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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
  getFreshSession,
  supabase,
} from "../lib/supabase";

type Role =
  | "reader"
  | "editor"
  | "superuser";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  active: boolean;
};

type AuditRow = {
  id: string;

  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;

  action: string;
  entity: string;

  entity_id: string | null;
  entity_label: string | null;

  old_data: unknown;
  new_data: unknown;
  metadata: unknown;

  ip_address: string | null;
  user_agent: string | null;

  created_at: string;
};

type AuditResponse = {
  ok?: boolean;
  rows?: AuditRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
};

const LOGIN_ROUTE =
  "/login" as Href;

const DASHBOARD_ROUTE =
  "/dashboard" as Href;

const PAGE_SIZE = 25;

const ACTIONS = [
  {
    value: "",
    label: "Todos",
  },
  {
    value: "FREIGHT_CREATED",
    label: "Creados",
  },
  {
    value: "FREIGHT_UPDATED",
    label: "Editados",
  },
  {
    value: "FREIGHT_DELETED",
    label: "Eliminados",
  },
];

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      "es-MX",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return value;
  }
}

function actionLabel(
  action: string
) {
  const labels:
    Record<
      string,
      string
    > = {
    USER_CREATED:
      "Usuario creado",

    USER_UPDATED:
      "Usuario actualizado",

    USER_ROLE_CHANGED:
      "Cambio de rol",

    USER_DISABLED:
      "Usuario desactivado",

    USER_ENABLED:
      "Usuario activado",

    USER_DELETED:
      "Usuario eliminado",

    FREIGHT_CREATED:
      "Flete creado",

    FREIGHT_UPDATED:
      "Flete actualizado",

    FREIGHT_DELETED:
      "Flete eliminado",

    CREATE:
      "Creación",

    UPDATE:
      "Actualización",

    DELETE:
      "Eliminación",
  };

  return (
    labels[action] ??
    action
  );
}

function entityLabel(
  entity: string
) {
  const labels:
    Record<
      string,
      string
    > = {
    users:
      "Usuarios",

    freight_services:
      "Fletes",

    freight_custom_fields:
      "Campos personalizados",

    freight_column_settings:
      "Columnas",
  };

  return (
    labels[entity] ??
    entity
  );
}

function getBadgeStyle(
  action: string
) {
  if (
    action ===
    "FREIGHT_UPDATED"
  ) {
    return {
      container:
        styles.badgeUpdated,

      text:
        styles.badgeUpdatedText,
    };
  }

  if (
    action ===
    "FREIGHT_CREATED"
  ) {
    return {
      container:
        styles.badgeCreated,

      text:
        styles.badgeCreatedText,
    };
  }

  if (
    action ===
    "FREIGHT_DELETED"
  ) {
    return {
      container:
        styles.badgeDeleted,

      text:
        styles.badgeDeletedText,
    };
  }

  if (
    action.startsWith(
      "USER_"
    )
  ) {
    return {
      container:
        styles.badgeUser,

      text:
        styles.badgeUserText,
    };
  }

  return {
    container:
      styles.badgeDefault,

    text:
      styles.badgeDefaultText,
  };
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value
    )
  );
}

function displayValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value ===
    "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return String(
        value
      );
    }
  }

  return String(
    value
  );
}

function getChanges(
  row: AuditRow
) {
  const oldData =
    isRecord(
      row.old_data
    )
      ? row.old_data
      : {};

  const newData =
    isRecord(
      row.new_data
    )
      ? row.new_data
      : {};

  const keys =
    Array.from(
      new Set([
        ...Object.keys(
          oldData
        ),

        ...Object.keys(
          newData
        ),
      ])
    );

  return keys
    .filter(
      (key) =>
        JSON.stringify(
          oldData[key]
        ) !==
        JSON.stringify(
          newData[key]
        )
    )
    .map(
      (key) => ({
        key,

        oldValue:
          oldData[key],

        newValue:
          newData[key],
      })
    );
}

function fieldLabel(
  key: string
) {
  const map:
    Record<
      string,
      string
    > = {
    service_date:
      "Fecha",

    unit:
      "Unidad",

    invoice:
      "Factura",

    client:
      "Cliente",

    service_type:
      "Tipo",

    category:
      "Categoría",

    container:
      "Contenedor",

    weight:
      "Peso",

    destination:
      "Destino",

    rodrigo_cash_freight:
      "Flete Rodrigo",

    invoice_freight:
      "Flete factura",

    carlos_cash_advance:
      "Anticipo Carlos",

    carlos_invoice_payment:
      "Pago Carlos",

    observations:
      "Observaciones",

    full_name:
      "Nombre",

    role:
      "Rol",

    active:
      "Activo",
  };

  return (
    map[key] ??
    key
  );
}

export default function AuditoriaScreen() {
  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    rows,
    setRows,
  ] =
    useState<AuditRow[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] =
    useState(false);

  const [
    total,
    setTotal,
  ] =
    useState(0);

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    actor,
    setActor,
  ] =
    useState("");

  const [
    from,
    setFrom,
  ] =
    useState("");

  const [
    to,
    setTo,
  ] =
    useState("");

  const [
    action,
    setAction,
  ] =
    useState("");

  const [
    selected,
    setSelected,
  ] =
    useState<AuditRow | null>(
      null
    );

  const apiUrl =
    process.env
      .EXPO_PUBLIC_API_URL;

  const hasMore =
    rows.length <
    total;

  const buildQuery =
    useCallback(
      (
        requestedPage:
          number
      ) => {
        const params:
          string[] = [];

        if (
          search.trim()
        ) {
          params.push(
            `search=${encodeURIComponent(
              search.trim()
            )}`
          );
        }

        if (
          actor.trim()
        ) {
          params.push(
            `actor=${encodeURIComponent(
              actor.trim()
            )}`
          );
        }

        if (action) {
          params.push(
            `action=${encodeURIComponent(
              action
            )}`
          );
        }

        if (from) {
          params.push(
            `from=${encodeURIComponent(
              from
            )}`
          );
        }

        if (to) {
          params.push(
            `to=${encodeURIComponent(
              to
            )}`
          );
        }

        params.push(
          `page=${requestedPage}`
        );

        params.push(
          `pageSize=${PAGE_SIZE}`
        );

        return params.join(
          "&"
        );
      },
      [
        action,
        actor,
        from,
        search,
        to,
      ]
    );

  const loadAudit =
    useCallback(
      async ({
        requestedPage =
          1,

        append =
          false,
      }: {
        requestedPage?:
          number;

        append?:
          boolean;
      } = {}) => {
        if (!apiUrl) {
          throw new Error(
            "No está configurada EXPO_PUBLIC_API_URL."
          );
        }

        const session =
          await getFreshSession();

        const query =
          buildQuery(
            requestedPage
          );

        const response =
          await fetch(
            `${apiUrl.replace(
              /\/+$/,
              ""
            )}/api/admin/audit?${query}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const text =
          await response.text();

        let data:
          AuditResponse = {};

        try {
          data =
            text
              ? JSON.parse(
                  text
                )
              : {};
        } catch {
          // Sin JSON válido
        }

        if (
          response.status ===
          401
        ) {
          await supabase.auth.signOut();

          router.replace(
            LOGIN_ROUTE
          );

          return;
        }

        if (
          response.status ===
          403
        ) {
          Alert.alert(
            "Sin permisos",
            data.error ??
              "Tu cuenta no tiene permisos para consultar auditoría."
          );

          return;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ??
              "No se pudo cargar la auditoría."
          );
        }

        const newRows =
          data.rows ??
          [];

        setRows(
          (previous) =>
            append
              ? [
                  ...previous,
                  ...newRows,
                ]
              : newRows
        );

        setTotal(
          data.total ??
            0
        );

        setPage(
          requestedPage
        );
      },
      [
        apiUrl,
        buildQuery,
      ]
    );

  useEffect(() => {
    let mounted =
      true;

    async function initialize() {
      try {
        const session =
          await getFreshSession();

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
              id,
              full_name,
              role,
              active
              `
            )
            .eq(
              "id",
              session.user.id
            )
            .single<Profile>();

        if (
          profileError ||
          !profileData
        ) {
          throw new Error(
            "No se pudo consultar tu perfil."
          );
        }

        if (
          !profileData.active ||
          profileData.role !==
            "superuser"
        ) {
          router.replace(
            DASHBOARD_ROUTE
          );

          return;
        }

        if (
          !mounted
        ) {
          return;
        }

        setProfile(
          profileData
        );
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo iniciar Auditoría."
        );
      }
    }

    void initialize();

    return () => {
      mounted =
        false;
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    async function firstLoad() {
      try {
        setLoading(
          true
        );

        await loadAudit({
          requestedPage:
            1,
        });
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo cargar la auditoría."
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    void firstLoad();
  }, [profile]);

  async function applyFilters() {
    try {
      setLoading(
        true
      );

      await loadAudit({
        requestedPage:
          1,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudieron aplicar los filtros."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function refresh() {
    try {
      setRefreshing(
        true
      );

      await loadAudit({
        requestedPage:
          1,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo actualizar."
      );
    } finally {
      setRefreshing(
        false
      );
    }
  }

  async function loadMore() {
    if (
      !hasMore ||
      loadingMore
    ) {
      return;
    }

    try {
      setLoadingMore(
        true
      );

      await loadAudit({
        requestedPage:
          page + 1,

        append:
          true,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudieron cargar más movimientos."
      );
    } finally {
      setLoadingMore(
        false
      );
    }
  }

  function clearFilters() {
    setSearch("");
    setActor("");
    setFrom("");
    setTo("");
    setAction("");
  }

  if (
    loading &&
    !profile
  ) {
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

  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.container
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void refresh()
            }
          />
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.backButton
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹ Volver
          </Text>
        </Pressable>

        <Text
          style={
            styles.eyebrow
          }
        >
          Administración
        </Text>

        <Text
          style={
            styles.title
          }
        >
          Auditoría
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Historial de actividad del
          sistema.
        </Text>

        <View
          style={
            styles.summaryRow
          }
        >
          <View>
            <Text
              style={
                styles.summaryValue
              }
            >
              {total}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              movimientos
            </Text>
          </View>

          <Text
            style={
              styles.summaryHint
            }
          >
            Desliza hacia abajo
            para actualizar
          </Text>
        </View>

        <View
          style={
            styles.filtersCard
          }
        >
          <View
            style={
              styles.filtersHeader
            }
          >
            <Text
              style={
                styles.filtersTitle
              }
            >
              Filtros
            </Text>

            <Pressable
              onPress={
                clearFilters
              }
            >
              <Text
                style={
                  styles.clearText
                }
              >
                Limpiar
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={
              search
            }
            onChangeText={
              setSearch
            }
            placeholder="Buscar folio o registro"
            placeholderTextColor="#8E8E93"
            style={
              styles.input
            }
          />

          <TextInput
            value={
              actor
            }
            onChangeText={
              setActor
            }
            placeholder="Usuario o correo"
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
            style={
              styles.input
            }
          />

          <View
            style={
              styles.chips
            }
          >
            {ACTIONS.map(
              (option) => {
                const active =
                  action ===
                  option.value;

                return (
                  <Pressable
                    key={
                      option.value ||
                      "all"
                    }
                    onPress={() =>
                      setAction(
                        option.value
                      )
                    }
                    style={[
                      styles.chip,

                      active &&
                        styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,

                        active &&
                          styles.chipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          <View
            style={
              styles.dateRow
            }
          >
            <TextInput
              value={
                from
              }
              onChangeText={
                setFrom
              }
              placeholder="Desde"
              placeholderTextColor="#8E8E93"
              style={[
                styles.input,
                styles.dateInput,
              ]}
            />

            <TextInput
              value={
                to
              }
              onChangeText={
                setTo
              }
              placeholder="Hasta"
              placeholderTextColor="#8E8E93"
              style={[
                styles.input,
                styles.dateInput,
              ]}
            />
          </View>

          <Pressable
            onPress={() =>
              void applyFilters()
            }
            style={({ pressed }) => [
              styles.applyButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.applyButtonText
              }
            >
              Aplicar filtros
            </Text>
          </Pressable>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          Movimientos recientes
        </Text>

        {loading ? (
          <View
            style={
              styles.inlineLoading
            }
          >
            <ActivityIndicator />
          </View>
        ) : rows.length ===
          0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Sin resultados
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              No hay movimientos que
              coincidan con los filtros.
            </Text>
          </View>
        ) : (
          rows.map(
            (row) => {
              const badge =
                getBadgeStyle(
                  row.action
                );

              return (
                <Pressable
                  key={
                    row.id
                  }
                  onPress={() =>
                    setSelected(
                      row
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.auditCard,

                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.auditHeader
                    }
                  >
                    <View
                      style={[
                        styles.badge,
                        badge.container,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          badge.text,
                        ]}
                      >
                        {actionLabel(
                          row.action
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.date
                      }
                    >
                      {formatDate(
                        row.created_at
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.auditTitle
                    }
                  >
                    {row.entity_label ||
                      entityLabel(
                        row.entity
                      )}
                  </Text>

                  <View
                    style={
                      styles.actorRow
                    }
                  >
                    <View
                      style={
                        styles.avatar
                      }
                    >
                      <Text
                        style={
                          styles.avatarText
                        }
                      >
                        {(
                          row.actor_name ||
                          row.actor_email ||
                          "U"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.actorInfo
                      }
                    >
                      <Text
                        style={
                          styles.actorName
                        }
                      >
                        {row.actor_name ||
                          "Sin nombre"}
                      </Text>

                      <Text
                        style={
                          styles.actorEmail
                        }
                      >
                        {row.actor_email ||
                          "Sin correo"}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.detailArrow
                      }
                    >
                      ›
                    </Text>
                  </View>
                </Pressable>
              );
            }
          )
        )}

        {hasMore && (
          <Pressable
            disabled={
              loadingMore
            }
            onPress={() =>
              void loadMore()
            }
            style={
              styles.loadMore
            }
          >
            {loadingMore ? (
              <ActivityIndicator />
            ) : (
              <Text
                style={
                  styles.loadMoreText
                }
              >
                Mostrar más
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      <AuditDetailModal
        row={
          selected
        }
        onClose={() =>
          setSelected(
            null
          )
        }
      />
    </SafeAreaView>
  );
}

function AuditDetailModal({
  row,
  onClose,
}: {
  row:
    AuditRow | null;

  onClose:
    () => void;
}) {
  if (!row) {
    return null;
  }

  const changes =
    getChanges(
      row
    );

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={
        onClose
      }
    >
      <View
        style={
          styles.modalOverlay
        }
      >
        <View
          style={
            styles.modalSheet
          }
        >
          <View
            style={
              styles.modalHandle
            }
          />

          <View
            style={
              styles.modalHeader
            }
          >
            <View
              style={
                styles.modalHeaderText
              }
            >
              <Text
                style={
                  styles.modalEyebrow
                }
              >
                {actionLabel(
                  row.action
                )}
              </Text>

              <Text
                style={
                  styles.modalTitle
                }
              >
                {row.entity_label ||
                  entityLabel(
                    row.entity
                  )}
              </Text>
            </View>

            <Pressable
              onPress={
                onClose
              }
            >
              <Text
                style={
                  styles.doneText
                }
              >
                Listo
              </Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
          >
            <DetailLine
              label="Fecha"
              value={formatDate(
                row.created_at
              )}
            />

            <DetailLine
              label="Usuario"
              value={
                row.actor_name ||
                "Sin nombre"
              }
            />

            <DetailLine
              label="Correo"
              value={
                row.actor_email ||
                "—"
              }
            />

            <DetailLine
              label="Módulo"
              value={entityLabel(
                row.entity
              )}
            />

            <Text
              style={
                styles.changeTitle
              }
            >
              Cambios
            </Text>

            {changes.length ===
            0 ? (
              <Text
                style={
                  styles.noChanges
                }
              >
                No hay comparación de
                campos disponible.
              </Text>
            ) : (
              changes.map(
                (change) => (
                  <View
                    key={
                      change.key
                    }
                    style={
                      styles.changeCard
                    }
                  >
                    <Text
                      style={
                        styles.changeField
                      }
                    >
                      {fieldLabel(
                        change.key
                      )}
                    </Text>

                    <View
                      style={
                        styles.changeValues
                      }
                    >
                      <View
                        style={
                          styles.changeSide
                        }
                      >
                        <Text
                          style={
                            styles.changeLabel
                          }
                        >
                          Antes
                        </Text>

                        <Text
                          style={
                            styles.oldValue
                          }
                        >
                          {displayValue(
                            change.oldValue
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.changeSide
                        }
                      >
                        <Text
                          style={
                            styles.changeLabelNew
                          }
                        >
                          Después
                        </Text>

                        <Text
                          style={
                            styles.newValue
                          }
                        >
                          {displayValue(
                            change.newValue
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              )
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.detailLine
      }
    >
      <Text
        style={
          styles.detailLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.detailValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor:
        "#F5F5F7",
    },

    container: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 50,
    },

    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#F5F5F7",
    },

    backButton: {
      alignSelf: "flex-start",
      paddingVertical: 8,
    },

    backText: {
      color: "#007AFF",
      fontSize: 17,
      fontWeight: "500",
    },

    eyebrow: {
      marginTop: 14,
      color: "#007AFF",
      fontSize: 13,
      fontWeight: "700",
    },

    title: {
      marginTop: 4,
      color: "#1D1D1F",
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -0.8,
    },

    subtitle: {
      marginTop: 5,
      color: "#6E6E73",
      fontSize: 15,
      marginBottom: 22,
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-end",
      marginBottom: 22,
    },

    summaryValue: {
      color: "#1D1D1F",
      fontSize: 28,
      fontWeight: "700",
    },

    summaryLabel: {
      marginTop: -2,
      color: "#6E6E73",
      fontSize: 13,
    },

    summaryHint: {
      maxWidth: 150,
      textAlign: "right",
      color: "#AEAEB2",
      fontSize: 11,
      lineHeight: 15,
    },

    filtersCard: {
      borderWidth: 1,
      borderColor: "#E5E5EA",
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      padding: 14,
    },

    filtersHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 10,
    },

    filtersTitle: {
      color: "#1D1D1F",
      fontSize: 17,
      fontWeight: "700",
    },

    clearText: {
      color: "#007AFF",
      fontSize: 14,
      fontWeight: "500",
    },

    input: {
      minHeight: 43,
      borderWidth: 1,
      borderColor: "#E5E5EA",
      borderRadius: 11,
      backgroundColor:
        "#F9F9FB",
      paddingHorizontal: 12,
      color: "#1D1D1F",
      fontSize: 14,
      marginBottom: 8,
    },

    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 2,
      marginBottom: 4,
    },

    chip: {
      borderWidth: 1,
      borderColor: "#E5E5EA",
      borderRadius: 20,
      paddingHorizontal: 13,
      paddingVertical: 7,
      marginRight: 6,
      marginBottom: 6,
      backgroundColor:
        "#FFFFFF",
    },

    chipActive: {
      backgroundColor:
        "#1D1D1F",
      borderColor:
        "#1D1D1F",
    },

    chipText: {
      color: "#6E6E73",
      fontSize: 12,
      fontWeight: "600",
    },

    chipTextActive: {
      color: "#FFFFFF",
    },

    dateRow: {
      flexDirection: "row",
    },

    dateInput: {
      flex: 1,
      marginRight: 6,
    },

    applyButton: {
      minHeight: 43,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#1D1D1F",
      marginTop: 2,
    },

    applyButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    sectionTitle: {
      marginTop: 28,
      marginBottom: 12,
      color: "#1D1D1F",
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.4,
    },

    inlineLoading: {
      paddingVertical: 30,
    },

    auditCard: {
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#E5E5EA",
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      padding: 15,
    },

    auditHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },

    badgeText: {
      fontSize: 11,
      fontWeight: "700",
    },

    badgeUpdated: {
      backgroundColor:
        "#F1FAF4",
      borderColor:
        "#A9DAB7",
    },

    badgeUpdatedText: {
      color: "#258044",
    },

    badgeCreated: {
      backgroundColor:
        "#F0F7FF",
      borderColor:
        "#B7D6FA",
    },

    badgeCreatedText: {
      color: "#1769AA",
    },

    badgeDeleted: {
      backgroundColor:
        "#FFF3F2",
      borderColor:
        "#F3B8B5",
    },

    badgeDeletedText: {
      color: "#C0392B",
    },

    badgeUser: {
      backgroundColor:
        "#F7F3FF",
      borderColor:
        "#D8C8F5",
    },

    badgeUserText: {
      color: "#7255B5",
    },

    badgeDefault: {
      backgroundColor:
        "#F2F2F7",
      borderColor:
        "#D1D1D6",
    },

    badgeDefaultText: {
      color: "#636366",
    },

    date: {
      color: "#8E8E93",
      fontSize: 11,
    },

    auditTitle: {
      marginTop: 13,
      color: "#1D1D1F",
      fontSize: 17,
      fontWeight: "700",
    },

    actorRow: {
      marginTop: 13,
      flexDirection: "row",
      alignItems: "center",
    },

    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#F2F2F7",
    },

    avatarText: {
      color: "#636366",
      fontSize: 13,
      fontWeight: "700",
    },

    actorInfo: {
      flex: 1,
      marginLeft: 10,
    },

    actorName: {
      color: "#3A3A3C",
      fontSize: 13,
      fontWeight: "600",
    },

    actorEmail: {
      marginTop: 2,
      color: "#8E8E93",
      fontSize: 11,
    },

    detailArrow: {
      color: "#C7C7CC",
      fontSize: 27,
      fontWeight: "300",
    },

    emptyCard: {
      borderWidth: 1,
      borderColor: "#E5E5EA",
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      padding: 24,
      alignItems: "center",
    },

    emptyTitle: {
      color: "#1D1D1F",
      fontSize: 16,
      fontWeight: "700",
    },

    emptyText: {
      marginTop: 5,
      color: "#8E8E93",
      fontSize: 13,
      textAlign: "center",
    },

    loadMore: {
      minHeight: 45,
      marginTop: 8,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E5E5EA",
    },

    loadMoreText: {
      color: "#007AFF",
      fontSize: 14,
      fontWeight: "600",
    },

    pressed: {
      opacity: 0.7,
    },

    modalOverlay: {
      flex: 1,
      justifyContent:
        "flex-end",
      backgroundColor:
        "rgba(0,0,0,0.28)",
    },

    modalSheet: {
      maxHeight: "88%",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal: 20,
      paddingBottom: 30,
    },

    modalHandle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      alignSelf: "center",
      marginTop: 8,
      marginBottom: 15,
      backgroundColor:
        "#D1D1D6",
    },

    modalHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },

    modalHeaderText: {
      flex: 1,
    },

    modalEyebrow: {
      color: "#007AFF",
      fontSize: 12,
      fontWeight: "600",
    },

    modalTitle: {
      marginTop: 4,
      color: "#1D1D1F",
      fontSize: 22,
      fontWeight: "800",
    },

    doneText: {
      color: "#007AFF",
      fontSize: 16,
      fontWeight: "600",
    },

    detailLine: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor:
        "#F2F2F7",
    },

    detailLabel: {
      color: "#8E8E93",
      fontSize: 11,
    },

    detailValue: {
      marginTop: 3,
      color: "#1D1D1F",
      fontSize: 14,
      fontWeight: "500",
    },

    changeTitle: {
      marginTop: 22,
      marginBottom: 10,
      color: "#1D1D1F",
      fontSize: 18,
      fontWeight: "700",
    },

    noChanges: {
      color: "#8E8E93",
      fontSize: 13,
    },

    changeCard: {
      marginBottom: 9,
      borderRadius: 14,
      backgroundColor:
        "#F9F9FB",
      padding: 13,
    },

    changeField: {
      color: "#1D1D1F",
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 10,
    },

    changeValues: {
      flexDirection: "row",
    },

    changeSide: {
      flex: 1,
      paddingRight: 8,
    },

    changeLabel: {
      color: "#8E8E93",
      fontSize: 10,
      fontWeight: "600",
    },

    changeLabelNew: {
      color: "#258044",
      fontSize: 10,
      fontWeight: "600",
    },

    oldValue: {
      marginTop: 3,
      color: "#636366",
      fontSize: 12,
    },

    newValue: {
      marginTop: 3,
      color: "#1D1D1F",
      fontSize: 12,
      fontWeight: "600",
    },
  });