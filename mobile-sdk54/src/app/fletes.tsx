import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  full_name: string | null;
  role: Role;
  active: boolean;
};

type FreightService = {
  id: string;

  folio:
    | string
    | number
    | null;

  service_date:
    string | null;

  unit:
    string | null;

  invoice:
    string | null;

  client:
    string | null;

  service_type:
    string | null;

  category:
    string | null;

  container:
    string | null;

  weight:
    number | null;

  destination:
    string | null;

  rodrigo_cash_freight:
    number | null;

  invoice_freight:
    number | null;

  carlos_cash_advance:
    number | null;

  carlos_invoice_payment:
    number | null;

  observations:
    string | null;

  created_at:
    string | null;

  updated_at:
    string | null;
};

const LOGIN_ROUTE =
  "/login" as Href;

const NUEVO_FLETE_ROUTE =
  "/nuevo-flete" as Href;

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Sin fecha";
  }

  const parts =
    value.split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function formatFolio(
  value:
    | string
    | number
    | null
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const raw =
    String(value);

  if (
    raw.startsWith("F-")
  ) {
    return raw;
  }

  return `F-${raw.padStart(
    4,
    "0"
  )}`;
}

function formatMoney(
  value:
    | number
    | null
) {
  const amount =
    Number(value ?? 0);

  return new Intl.NumberFormat(
    "es-MX",
    {
      style:
        "currency",

      currency:
        "MXN",

      minimumFractionDigits:
        2,
    }
  ).format(amount);
}

function safeText(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

export default function FletesScreen() {
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
    deleting,
    setDeleting,
  ] =
    useState(false);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    fletes,
    setFletes,
  ] =
    useState<
      FreightService[]
    >([]);

  const [
    profile,
    setProfile,
  ] =
    useState<
      Profile | null
    >(null);

  const [
    selectedFreight,
    setSelectedFreight,
  ] =
    useState<
      FreightService | null
    >(null);

  const loadData =
    useCallback(
      async (
        isRefresh = false
      ) => {
        try {
          if (isRefresh) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

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
            await supabase.auth.signOut();

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
            !profileData
          ) {
            throw new Error(
              "No se pudo cargar el perfil."
            );
          }

          if (
            !profileData.active
          ) {
            await supabase.auth.signOut();

            router.replace(
              LOGIN_ROUTE
            );

            return;
          }

          setProfile(
            profileData
          );

          const {
            data:
              freightData,

            error:
              freightError,
          } =
            await supabase
              .from(
                "freight_services"
              )
              .select(
                `
                id,
                folio,
                service_date,
                unit,
                invoice,
                client,
                service_type,
                category,
                container,
                weight,
                destination,
                rodrigo_cash_freight,
                invoice_freight,
                carlos_cash_advance,
                carlos_invoice_payment,
                observations,
                created_at,
                updated_at
                `
              )
              .order(
                "service_date",
                {
                  ascending:
                    false,
                }
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              );

          if (
            freightError
          ) {
            throw freightError;
          }

          setFletes(
            (
              freightData ??
              []
            ) as FreightService[]
          );
        } catch (
          error
        ) {
          Alert.alert(
            "No se pudieron cargar los fletes",

            error instanceof
              Error
              ? error.message
              : "Ocurrió un error."
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredFletes =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return fletes;
      }

      return fletes.filter(
        (
          freight
        ) => {
          const searchable =
            [
              freight.folio,
              freight.unit,
              freight.invoice,
              freight.client,
              freight.service_type,
              freight.category,
              freight.container,
              freight.destination,
              freight.observations,
            ]
              .filter(
                (
                  item
                ) =>
                  item !==
                    null &&
                  item !==
                    undefined
              )
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            term
          );
        }
      );
    }, [
      fletes,
      search,
    ]);

  const totalInvoice =
    useMemo(() => {
      return fletes.reduce(
        (
          total,
          freight
        ) =>
          total +
          Number(
            freight.invoice_freight ??
              0
          ),
        0
      );
    }, [fletes]);

  const canEdit =
    profile?.role ===
      "editor" ||
    profile?.role ===
      "superuser";

  const canDelete =
    profile?.role ===
    "superuser";

  const roleLabel =
    profile?.role ===
    "superuser"
      ? "Superusuario"
      : profile?.role ===
          "editor"
        ? "Editor"
        : "Lector";

  async function deleteFreight(
    freight:
      FreightService
  ) {
    if (deleting) {
      return;
    }

    try {
      setDeleting(
        true
      );

      const session =
  await getFreshSession();

      if (!session) {
        router.replace(
          LOGIN_ROUTE
        );

        return;
      }

      const apiUrl =
        process.env
          .EXPO_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error(
          "No está configurada EXPO_PUBLIC_API_URL."
        );
      }

      const baseUrl =
        apiUrl.replace(
          /\/+$/,
          ""
        );

      const response =
        await fetch(
          `${baseUrl}/api/fletes/${freight.id}`,
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const responseText =
        await response.text();

      let result: {
        error?: string;
      } = {};

      try {
        result =
          responseText
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        console.log(
          "Respuesta DELETE no JSON:",
          responseText
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          typeof result.error ===
            "string"
            ? result.error
            : `Error ${response.status}: ${
                responseText ||
                "No se pudo eliminar el flete."
              }`
        );
      }

      setSelectedFreight(
        null
      );

      setFletes(
        (
          previous
        ) =>
          previous.filter(
            (
              item
            ) =>
              item.id !==
              freight.id
          )
      );

      Alert.alert(
        "Flete eliminado",
        `${formatFolio(
          freight.folio
        )} se eliminó correctamente.`
      );

      await loadData(
        true
      );
    } catch (
      error
    ) {
      Alert.alert(
        "No se pudo eliminar",

        error instanceof
          Error
          ? error.message
          : "Ocurrió un error."
      );
    } finally {
      setDeleting(
        false
      );
    }
  }

  function confirmDelete(
    freight:
      FreightService
  ) {
    Alert.alert(
      "Eliminar flete",

      `¿Seguro que deseas eliminar ${formatFolio(
        freight.folio
      )}?\n\nEsta acción no se puede deshacer.`,

      [
        {
          text:
            "Cancelar",

          style:
            "cancel",
        },

        {
          text:
            "Eliminar",

          style:
            "destructive",

          onPress:
            () => {
              void deleteFreight(
                freight
              );
            },
        },
      ]
    );
  }

  function goToEdit(
    freight:
      FreightService
  ) {
    const id =
      freight.id;

    setSelectedFreight(
      null
    );

    router.push(
      {
        pathname:
          "/editar-flete",

        params: {
          id,
        },
      } as never
    );
  }

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando fletes...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      <FlatList
        data={
          filteredFletes
        }
        keyExtractor={(
          item
        ) =>
          item.id
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void loadData(
                true
              )
            }
          />
        }
        ListHeaderComponent={
          <>
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
                ← Dashboard
              </Text>
            </Pressable>

            <View
              style={
                styles.headerRow
              }
            >
              <View
                style={
                  styles.headerTextContainer
                }
              >
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  Operación
                </Text>

                <Text
                  style={
                    styles.title
                  }
                >
                  Relación de Fletes
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  Consulta y administra
                  los registros del
                  sistema.
                </Text>
              </View>

              <View
                style={
                  styles.permissionBadge
                }
              >
                <Text
                  style={
                    styles.permissionBadgeText
                  }
                >
                  {roleLabel}
                </Text>
              </View>
            </View>

            {canEdit && (
              <Pressable
                onPress={() =>
                  router.push(
                    NUEVO_FLETE_ROUTE
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.newButton,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.newButtonText
                  }
                >
                  + Nuevo flete
                </Text>
              </Pressable>
            )}

            <View
              style={
                styles.statsRow
              }
            >
              <View
                style={
                  styles.statCard
                }
              >
                <Text
                  style={
                    styles.statLabel
                  }
                >
                  REGISTROS
                </Text>

                <Text
                  style={
                    styles.statValue
                  }
                >
                  {
                    fletes.length
                  }
                </Text>
              </View>

              <View
                style={
                  styles.statCard
                }
              >
                <Text
                  style={
                    styles.statLabel
                  }
                >
                  FLETE FACTURA
                </Text>

                <Text
                  numberOfLines={
                    1
                  }
                  adjustsFontSizeToFit
                  style={
                    styles.statMoney
                  }
                >
                  {formatMoney(
                    totalInvoice
                  )}
                </Text>
              </View>
            </View>

            <TextInput
              value={
                search
              }
              onChangeText={
                setSearch
              }
              placeholder="Buscar folio, cliente, unidad, destino..."
              placeholderTextColor="#94a3b8"
              autoCorrect={
                false
              }
              clearButtonMode="while-editing"
              style={
                styles.searchInput
              }
            />

            <View
              style={
                styles.resultsHeader
              }
            >
              <Text
                style={
                  styles.resultsTitle
                }
              >
                Fletes
              </Text>

              <Text
                style={
                  styles.resultsCount
                }
              >
                {
                  filteredFletes.length
                }{" "}
                resultado
                {filteredFletes.length ===
                1
                  ? ""
                  : "s"}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
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
              No hay resultados
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              No encontramos fletes
              que coincidan con tu
              búsqueda.
            </Text>
          </View>
        }
        renderItem={({
          item,
        }) => (
          <Pressable
            onPress={() =>
              setSelectedFreight(
                item
              )
            }
            style={({
              pressed,
            }) => [
              styles.freightCard,

              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.cardTopRow
              }
            >
              <View
                style={
                  styles.folioContainer
                }
              >
                <Text
                  style={
                    styles.folioLabel
                  }
                >
                  FOLIO
                </Text>

                <Text
                  style={
                    styles.folio
                  }
                >
                  {formatFolio(
                    item.folio
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.dateBadge
                }
              >
                <Text
                  style={
                    styles.dateBadgeText
                  }
                >
                  {formatDate(
                    item.service_date
                  )}
                </Text>
              </View>
            </View>

            <Text
              style={
                styles.client
              }
              numberOfLines={
                2
              }
            >
              {safeText(
                item.client
              )}
            </Text>

            <View
              style={
                styles.metaRow
              }
            >
              <View
                style={
                  styles.metaItem
                }
              >
                <Text
                  style={
                    styles.metaLabel
                  }
                >
                  UNIDAD
                </Text>

                <Text
                  style={
                    styles.metaValue
                  }
                >
                  {safeText(
                    item.unit
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.metaItem
                }
              >
                <Text
                  style={
                    styles.metaLabel
                  }
                >
                  TIPO
                </Text>

                <Text
                  style={
                    styles.metaValue
                  }
                >
                  {safeText(
                    item.service_type
                  )}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.metaRow
              }
            >
              <View
                style={
                  styles.metaItem
                }
              >
                <Text
                  style={
                    styles.metaLabel
                  }
                >
                  CATEGORÍA
                </Text>

                <Text
                  style={
                    styles.metaValue
                  }
                >
                  {safeText(
                    item.category
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.metaItem
                }
              >
                <Text
                  style={
                    styles.metaLabel
                  }
                >
                  DESTINO
                </Text>

                <Text
                  style={
                    styles.metaValue
                  }
                  numberOfLines={
                    2
                  }
                >
                  {safeText(
                    item.destination
                  )}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.moneyRow
              }
            >
              <View>
                <Text
                  style={
                    styles.moneyLabel
                  }
                >
                  Flete factura
                </Text>

                <Text
                  style={
                    styles.moneyValue
                  }
                >
                  {formatMoney(
                    item.invoice_freight
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.viewDetail
                }
              >
                Ver detalle →
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Modal
        visible={
          selectedFreight !==
          null
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setSelectedFreight(
            null
          )
        }
      >
        {selectedFreight && (
          <SafeAreaView
            style={
              styles.modalSafe
            }
          >
            <ScrollView
              contentContainerStyle={
                styles.modalContent
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.modalEyebrow
                    }
                  >
                    Detalle del servicio
                  </Text>

                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    {formatFolio(
                      selectedFreight.folio
                    )}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setSelectedFreight(
                      null
                    )
                  }
                  style={
                    styles.closeButton
                  }
                >
                  <Text
                    style={
                      styles.closeButtonText
                    }
                  >
                    Cerrar
                  </Text>
                </Pressable>
              </View>

              <View
                style={
                  styles.detailTopActions
                }
              >
                {canEdit && (
                  <Pressable
                    onPress={() =>
                      goToEdit(
                        selectedFreight
                      )
                    }
                    style={({ pressed }) => [
                      styles.topEditButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.topEditButtonText
                      }
                    >
                      Editar
                    </Text>
                  </Pressable>
                )}

                {canDelete && (
                  <Pressable
                    disabled={deleting}
                    onPress={() =>
                      confirmDelete(
                        selectedFreight
                      )
                    }
                    style={({ pressed }) => [
                      styles.topDeleteButton,
                      pressed &&
                        styles.pressed,
                      deleting &&
                        styles.disabledButton,
                    ]}
                  >
                    {deleting ? (
                      <ActivityIndicator
                        color="#dc2626"
                      />
                    ) : (
                      <Text
                        style={
                          styles.topDeleteButtonText
                        }
                      >
                        Eliminar
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>

              <DetailRow
                label="Fecha"
                value={formatDate(
                  selectedFreight.service_date
                )}
              />

              <DetailRow
                label="Unidad"
                value={safeText(
                  selectedFreight.unit
                )}
              />

              <DetailRow
                label="Factura"
                value={safeText(
                  selectedFreight.invoice
                )}
              />

              <DetailRow
                label="Cliente"
                value={safeText(
                  selectedFreight.client
                )}
              />

              <DetailRow
                label="Tipo"
                value={safeText(
                  selectedFreight.service_type
                )}
              />

              <DetailRow
                label="Categoría"
                value={safeText(
                  selectedFreight.category
                )}
              />

              <DetailRow
                label="Contenedor"
                value={safeText(
                  selectedFreight.container
                )}
              />

              <DetailRow
                label="Peso"
                value={
                  selectedFreight.weight !==
                  null
                    ? String(
                        selectedFreight.weight
                      )
                    : "—"
                }
              />

              <DetailRow
                label="Destino"
                value={safeText(
                  selectedFreight.destination
                )}
              />

              <Text
                style={
                  styles.modalSectionTitle
                }
              >
                Importes
              </Text>

              <MoneyDetail
                label="Flete efectivo Rodrigo"
                value={
                  selectedFreight.rodrigo_cash_freight
                }
              />

              <MoneyDetail
                label="Flete factura"
                value={
                  selectedFreight.invoice_freight
                }
              />

              <MoneyDetail
                label="Anticipo efectivo Carlos"
                value={
                  selectedFreight.carlos_cash_advance
                }
              />

              <MoneyDetail
                label="Pago factura Carlos"
                value={
                  selectedFreight.carlos_invoice_payment
                }
              />

              <Text
                style={
                  styles.modalSectionTitle
                }
              >
                Observaciones
              </Text>

              <View
                style={
                  styles.observationsCard
                }
              >
                <Text
                  style={
                    styles.observationsText
                  }
                >
                  {safeText(
                    selectedFreight.observations
                  )}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setSelectedFreight(
                    null
                  )
                }
                style={
                  styles.modalCloseMain
                }
              >
                <Text
                  style={
                    styles.modalCloseMainText
                  }
                >
                  Cerrar detalle
                </Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <View
      style={
        styles.detailRow
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

function MoneyDetail({
  label,
  value,
}: {
  label:
    string;

  value:
    | number
    | null;
}) {
  return (
    <View
      style={
        styles.moneyDetailRow
      }
    >
      <Text
        style={
          styles.moneyDetailLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.moneyDetailValue
        }
      >
        {formatMoney(
          value
        )}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,

      backgroundColor:
        "#f8fafc",
    },

    loadingContainer: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#f8fafc",
    },

    loadingText: {
      marginTop:
        12,

      color:
        "#64748b",

      fontSize:
        15,
    },

    listContent: {
      paddingHorizontal:
        20,

      paddingBottom:
        50,
    },

    backButton: {
      alignSelf:
        "flex-start",

      marginTop:
        12,

      marginBottom:
        22,

      paddingVertical:
        6,
    },

    backText: {
      color:
        "#64748b",

      fontSize:
        16,

      fontWeight:
        "600",
    },

    headerRow: {
      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "flex-start",

      gap:
        12,
    },

    headerTextContainer: {
      flex:
        1,
    },

    eyebrow: {
      color:
        "#2563eb",

      fontSize:
        14,

      fontWeight:
        "700",
    },

    title: {
      marginTop:
        6,

      color:
        "#0f172a",

      fontSize:
        30,

      fontWeight:
        "800",
    },

    subtitle: {
      marginTop:
        8,

      color:
        "#64748b",

      fontSize:
        15,

      lineHeight:
        22,
    },

    permissionBadge: {
      marginTop:
        3,

      borderRadius:
        999,

      backgroundColor:
        "#dbeafe",

      paddingHorizontal:
        12,

      paddingVertical:
        7,
    },

    permissionBadgeText: {
      color:
        "#1d4ed8",

      fontSize:
        12,

      fontWeight:
        "700",
    },

    newButton: {
      marginTop:
        22,

      borderRadius:
        15,

      backgroundColor:
        "#0f172a",

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingVertical:
        16,
    },

    newButtonText: {
      color:
        "#ffffff",

      fontSize:
        16,

      fontWeight:
        "800",
    },

    pressed: {
      opacity:
        0.75,
    },

    disabledButton: {
      opacity:
        0.5,
    },

    detailTopActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
      marginBottom: 18,
    },

    topEditButton: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: "#0F172A",
      alignItems: "center",
      justifyContent: "center",
    },

    topEditButtonText: {
      color: "#ffffff",
      fontWeight: "800",
      fontSize: 15,
    },

    topDeleteButton: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: "#FEF2F2",
      borderWidth: 1,
      borderColor: "#FECACA",
      alignItems: "center",
      justifyContent: "center",
    },

    topDeleteButtonText: {
      color: "#DC2626",
      fontWeight: "800",
      fontSize: 15,
    },

    statsRow: {
      flexDirection:
        "row",

      gap:
        12,

      marginTop:
        18,
    },

    statCard: {
      flex:
        1,

      minHeight:
        105,

      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        18,

      backgroundColor:
        "#ffffff",

      padding:
        16,

      justifyContent:
        "center",
    },

    statLabel: {
      color:
        "#94a3b8",

      fontSize:
        11,

      fontWeight:
        "800",
    },

    statValue: {
      marginTop:
        8,

      color:
        "#0f172a",

      fontSize:
        28,

      fontWeight:
        "800",
    },

    statMoney: {
      marginTop:
        8,

      color:
        "#0f172a",

      fontSize:
        18,

      fontWeight:
        "800",
    },

    searchInput: {
      marginTop:
        18,

      height:
        52,

      borderWidth:
        1,

      borderColor:
        "#cbd5e1",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      paddingHorizontal:
        16,

      color:
        "#0f172a",

      fontSize:
        15,
    },

    resultsHeader: {
      marginTop:
        26,

      marginBottom:
        12,

      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "center",
    },

    resultsTitle: {
      color:
        "#0f172a",

      fontSize:
        22,

      fontWeight:
        "800",
    },

    resultsCount: {
      color:
        "#64748b",

      fontSize:
        13,
    },

    freightCard: {
      marginBottom:
        14,

      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        20,

      backgroundColor:
        "#ffffff",

      padding:
        18,
    },

    cardTopRow: {
      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "flex-start",

      gap:
        10,
    },

    folioContainer: {
      flex:
        1,
    },

    folioLabel: {
      color:
        "#94a3b8",

      fontSize:
        10,

      fontWeight:
        "800",
    },

    folio: {
      marginTop:
        3,

      color:
        "#0f172a",

      fontSize:
        19,

      fontWeight:
        "800",
    },

    dateBadge: {
      borderRadius:
        999,

      backgroundColor:
        "#f1f5f9",

      paddingHorizontal:
        11,

      paddingVertical:
        6,
    },

    dateBadgeText: {
      color:
        "#475569",

      fontSize:
        12,

      fontWeight:
        "600",
    },

    client: {
      marginTop:
        15,

      color:
        "#2563eb",

      fontSize:
        17,

      fontWeight:
        "700",
    },

    metaRow: {
      flexDirection:
        "row",

      gap:
        12,

      marginTop:
        16,
    },

    metaItem: {
      flex:
        1,
    },

    metaLabel: {
      color:
        "#94a3b8",

      fontSize:
        10,

      fontWeight:
        "800",
    },

    metaValue: {
      marginTop:
        4,

      color:
        "#334155",

      fontSize:
        14,

      fontWeight:
        "600",
    },

    moneyRow: {
      marginTop:
        18,

      paddingTop:
        16,

      borderTopWidth:
        1,

      borderTopColor:
        "#e2e8f0",

      flexDirection:
        "row",

      alignItems:
        "flex-end",

      justifyContent:
        "space-between",

      gap:
        12,
    },

    moneyLabel: {
      color:
        "#94a3b8",

      fontSize:
        11,

      fontWeight:
        "700",
    },

    moneyValue: {
      marginTop:
        4,

      color:
        "#0f172a",

      fontSize:
        17,

      fontWeight:
        "800",
    },

    viewDetail: {
      color:
        "#2563eb",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    emptyCard: {
      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        20,

      backgroundColor:
        "#ffffff",

      padding:
        24,

      alignItems:
        "center",
    },

    emptyTitle: {
      color:
        "#0f172a",

      fontSize:
        18,

      fontWeight:
        "800",
    },

    emptyText: {
      marginTop:
        8,

      color:
        "#64748b",

      textAlign:
        "center",

      lineHeight:
        21,
    },

    modalSafe: {
      flex:
        1,

      backgroundColor:
        "#f8fafc",
    },

    modalContent: {
      padding:
        22,

      paddingBottom:
        50,
    },

    modalHeader: {
      marginBottom:
        24,

      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "flex-start",

      gap:
        12,
    },

    modalEyebrow: {
      color:
        "#2563eb",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    modalTitle: {
      marginTop:
        5,

      color:
        "#0f172a",

      fontSize:
        28,

      fontWeight:
        "800",
    },

    closeButton: {
      borderWidth:
        1,

      borderColor:
        "#cbd5e1",

      borderRadius:
        12,

      paddingHorizontal:
        13,

      paddingVertical:
        8,

      backgroundColor:
        "#ffffff",
    },

    closeButtonText: {
      color:
        "#475569",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    detailRow: {
      marginBottom:
        10,

      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      padding:
        16,
    },

    detailLabel: {
      color:
        "#94a3b8",

      fontSize:
        11,

      fontWeight:
        "800",
    },

    detailValue: {
      marginTop:
        5,

      color:
        "#0f172a",

      fontSize:
        16,

      fontWeight:
        "600",
    },

    modalSectionTitle: {
      marginTop:
        22,

      marginBottom:
        11,

      color:
        "#0f172a",

      fontSize:
        20,

      fontWeight:
        "800",
    },

    moneyDetailRow: {
      marginBottom:
        10,

      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      padding:
        16,

      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap:
        12,
    },

    moneyDetailLabel: {
      flex:
        1,

      color:
        "#475569",

      fontSize:
        14,

      fontWeight:
        "600",
    },

    moneyDetailValue: {
      color:
        "#0f172a",

      fontSize:
        15,

      fontWeight:
        "800",
    },

    observationsCard: {
      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      padding:
        16,

      minHeight:
        90,
    },

    observationsText: {
      color:
        "#475569",

      fontSize:
        15,

      lineHeight:
        22,
    },

    editButton: {
      marginTop:
        24,

      height:
        54,

      borderRadius:
        15,

      backgroundColor:
        "#2563eb",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    editButtonText: {
      color:
        "#ffffff",

      fontSize:
        15,

      fontWeight:
        "800",
    },

    deleteButton: {
      marginTop:
        12,

      height:
        54,

      borderWidth:
        1,

      borderColor:
        "#dc2626",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    deleteButtonText: {
      color:
        "#dc2626",

      fontSize:
        15,

      fontWeight:
        "800",
    },

    modalCloseMain: {
      marginTop:
        12,

      borderRadius:
        15,

      backgroundColor:
        "#0f172a",

      alignItems:
        "center",

      paddingVertical:
        16,
    },

    modalCloseMainText: {
      color:
        "#ffffff",

      fontSize:
        15,

      fontWeight:
        "800",
    },
  });