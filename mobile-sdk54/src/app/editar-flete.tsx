import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
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
  role: Role;
  active: boolean;
};

type CatalogType =
  | "UNIT"
  | "CLIENT"
  | "SERVICE_TYPE"
  | "CATEGORY"
  | "DESTINATION";

type CatalogOption = {
  id: string;
  catalog_type: CatalogType;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
};

type FreightService = {
  id: string;
  folio: string | number | null;
  service_date: string | null;
  unit: string | null;
  invoice: string | null;
  client: string | null;
  service_type: string | null;
  category: string | null;
  container: string | null;
  weight: number | null;
  destination: string | null;
  rodrigo_cash_freight: number | null;
  invoice_freight: number | null;
  carlos_cash_advance: number | null;
  carlos_invoice_payment: number | null;
  observations: string | null;
  custom_fields?: Record<string, unknown> | null;
};

type FormState = {
  service_date: string;
  unit: string;
  invoice: string;
  client: string;
  service_type: string;
  category: string;
  container: string;
  weight: string;
  destination: string;
  rodrigo_cash_freight: string;
  invoice_freight: string;
  carlos_cash_advance: string;
  carlos_invoice_payment: string;
  observations: string;
};

type SelectorState = {
  visible: boolean;
  title: string;
  field: keyof FormState | null;
  catalogType: CatalogType | null;
};

const LOGIN_ROUTE =
  "/login" as Href;

const FLETES_ROUTE =
  "/fletes" as Href;

function numberToString(
  value: number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function optionalNumber(
  value: string
): number | null {
  const normalized =
    value
      .replace(/,/g, "")
      .trim();

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export default function EditarFleteScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const freightId =
    typeof params.id ===
    "string"
      ? params.id
      : "";

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    folio,
    setFolio,
  ] =
    useState<
      string | number | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<FormState>({
      service_date: "",
      unit: "",
      invoice: "",
      client: "",
      service_type: "",
      category: "",
      container: "",
      weight: "",
      destination: "",
      rodrigo_cash_freight: "",
      invoice_freight: "",
      carlos_cash_advance: "",
      carlos_invoice_payment: "",
      observations: "",
    });

  const [
    catalogOptions,
    setCatalogOptions,
  ] =
    useState<
      CatalogOption[]
    >([]);

  const [
    selector,
    setSelector,
  ] =
    useState<SelectorState>({
      visible: false,
      title: "",
      field: null,
      catalogType: null,
    });

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        if (!freightId) {
          throw new Error(
            "No se recibió el ID del flete."
          );
        }

        setLoading(true);

        const session =
  await getFreshSession();

const user =
  session.user;

       

        const {
          data:
            profileData,
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

        if (
          profileData.role !==
            "editor" &&
          profileData.role !==
            "superuser"
        ) {
          Alert.alert(
            "Sin permisos",
            "Tu usuario no puede editar fletes."
          );

          router.replace(
            FLETES_ROUTE
          );

          return;
        }

        const [
          freightResult,
          catalogResult,
        ] =
          await Promise.all([
            supabase
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
                custom_fields
                `
              )
              .eq(
                "id",
                freightId
              )
              .single<FreightService>(),

            supabase
              .from(
                "freight_catalog_options"
              )
              .select(
                `
                id,
                catalog_type,
                value,
                label,
                active,
                sort_order
                `
              )
              .eq(
                "active",
                true
              )
              .order(
                "catalog_type",
                {
                  ascending:
                    true,
                }
              )
              .order(
                "sort_order",
                {
                  ascending:
                    true,
                }
              ),
          ]);

        if (
          freightResult.error ||
          !freightResult.data
        ) {
          throw new Error(
            "No se pudo cargar el flete."
          );
        }

        if (
          catalogResult.error
        ) {
          throw catalogResult.error;
        }

        if (!mounted) {
          return;
        }

        const freight =
          freightResult.data;

        setProfile(
          profileData
        );

        setFolio(
          freight.folio
        );

        setCatalogOptions(
          (
            catalogResult.data ??
            []
          ) as CatalogOption[]
        );

        setForm({
          service_date:
            freight.service_date ??
            "",

          unit:
            freight.unit ??
            "",

          invoice:
            freight.invoice ??
            "",

          client:
            freight.client ??
            "",

          service_type:
            freight.service_type ??
            "",

          category:
            freight.category ??
            "",

          container:
            freight.container ??
            "",

          weight:
            numberToString(
              freight.weight
            ),

          destination:
            freight.destination ??
            "",

          rodrigo_cash_freight:
            numberToString(
              freight.rodrigo_cash_freight
            ),

          invoice_freight:
            numberToString(
              freight.invoice_freight
            ),

          carlos_cash_advance:
            numberToString(
              freight.carlos_cash_advance
            ),

          carlos_invoice_payment:
            numberToString(
              freight.carlos_invoice_payment
            ),

          observations:
            freight.observations ??
            "",
        });
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo cargar el flete."
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
  }, [freightId]);

  const selectorOptions =
    useMemo(() => {
      if (
        !selector.catalogType
      ) {
        return [];
      }

      return catalogOptions.filter(
        (
          option
        ) =>
          option.catalog_type ===
          selector.catalogType
      );
    }, [
      catalogOptions,
      selector.catalogType,
    ]);

  function updateForm(
    field:
      keyof FormState,
    value: string
  ) {
    setForm(
      (
        previous
      ) => ({
        ...previous,
        [field]:
          value,
      })
    );
  }

  function openSelector(
    title: string,
    field:
      keyof FormState,
    catalogType:
      CatalogType
  ) {
    setSelector({
      visible: true,
      title,
      field,
      catalogType,
    });
  }

  function selectOption(
    value: string
  ) {
    if (
      selector.field
    ) {
      updateForm(
        selector.field,
        value
      );
    }

    setSelector({
      visible: false,
      title: "",
      field: null,
      catalogType: null,
    });
  }

  async function performSave() {
    if (
      !form.service_date.trim()
    ) {
      Alert.alert(
        "Revisa el formulario",
        "La fecha es obligatoria."
      );

      return;
    }

    try {
      setSaving(true);

      const session =
  await getFreshSession();

      const apiUrl =
        process.env
          .EXPO_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error(
          "No está configurada EXPO_PUBLIC_API_URL."
        );
      }

      const response =
        await fetch(
          `${apiUrl.replace(
            /\/+$/,
            ""
          )}/api/fletes/${freightId}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                service_date:
                  form.service_date,

                unit:
                  form.unit,

                invoice:
                  form.invoice,

                client:
                  form.client,

                service_type:
                  form.service_type,

                category:
                  form.category,

                container:
                  form.container,

                weight:
                  optionalNumber(
                    form.weight
                  ),

                destination:
                  form.destination,

                rodrigo_cash_freight:
                  optionalNumber(
                    form.rodrigo_cash_freight
                  ) ?? 0,

                invoice_freight:
                  optionalNumber(
                    form.invoice_freight
                  ) ?? 0,

                carlos_cash_advance:
                  optionalNumber(
                    form.carlos_cash_advance
                  ) ?? 0,

                carlos_invoice_payment:
                  optionalNumber(
                    form.carlos_invoice_payment
                  ) ?? 0,

                observations:
                  form.observations,
              }),
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
        // ignore
      }

      if (!response.ok) {
        throw new Error(
          result.error ??
            `Error ${response.status}: ${responseText}`
        );
      }

      Alert.alert(
        "Flete actualizado",
        `El flete ${
          folio
            ? `F-${String(
                folio
              ).padStart(
                4,
                "0"
              )}`
            : ""
        } se actualizó correctamente.`,
        [
          {
            text:
              "Aceptar",

            onPress:
              () =>
                router.replace(
                  FLETES_ROUTE
                ),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "No se pudo actualizar",
        error instanceof Error
          ? error.message
          : "Ocurrió un error."
      );
    } finally {
      setSaving(false);
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

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando flete...
        </Text>
      </View>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.container
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.back
              }
            >
              ← Volver
            </Text>
          </Pressable>

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
            Editar flete
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Folio{" "}
            {folio ??
              "—"}
          </Text>

          <Text
            style={
              styles.section
            }
          >
            Servicio
          </Text>

          <FormInput
            label="Fecha"
            value={
              form.service_date
            }
            placeholder="AAAA-MM-DD"
            onChangeText={(
              value
            ) =>
              updateForm(
                "service_date",
                value
              )
            }
          />

          <CatalogField
            label="Unidad"
            value={
              form.unit
            }
            onPress={() =>
              openSelector(
                "Unidad",
                "unit",
                "UNIT"
              )
            }
          />

          <FormInput
            label="Factura"
            value={
              form.invoice
            }
            placeholder="Número de factura"
            onChangeText={(
              value
            ) =>
              updateForm(
                "invoice",
                value
              )
            }
          />

          <CatalogField
            label="Cliente"
            value={
              form.client
            }
            onPress={() =>
              openSelector(
                "Cliente",
                "client",
                "CLIENT"
              )
            }
          />

          <CatalogField
            label="Tipo"
            value={
              form.service_type
            }
            onPress={() =>
              openSelector(
                "Tipo",
                "service_type",
                "SERVICE_TYPE"
              )
            }
          />

          <CatalogField
            label="Categoría"
            value={
              form.category
            }
            onPress={() =>
              openSelector(
                "Categoría",
                "category",
                "CATEGORY"
              )
            }
          />

          <FormInput
            label="Contenedor"
            value={
              form.container
            }
            placeholder="Contenedor"
            onChangeText={(
              value
            ) =>
              updateForm(
                "container",
                value
              )
            }
          />

          <FormInput
            label="Peso"
            value={
              form.weight
            }
            placeholder="0"
            keyboardType="decimal-pad"
            onChangeText={(
              value
            ) =>
              updateForm(
                "weight",
                value
              )
            }
          />

          <CatalogField
            label="Destino"
            value={
              form.destination
            }
            onPress={() =>
              openSelector(
                "Destino",
                "destination",
                "DESTINATION"
              )
            }
          />

          <Text
            style={
              styles.section
            }
          >
            Importes
          </Text>

          <FormInput
            label="Flete efectivo Rodrigo"
            value={
              form.rodrigo_cash_freight
            }
            placeholder="$0.00"
            keyboardType="decimal-pad"
            onChangeText={(
              value
            ) =>
              updateForm(
                "rodrigo_cash_freight",
                value
              )
            }
          />

          <FormInput
            label="Flete factura"
            value={
              form.invoice_freight
            }
            placeholder="$0.00"
            keyboardType="decimal-pad"
            onChangeText={(
              value
            ) =>
              updateForm(
                "invoice_freight",
                value
              )
            }
          />

          <FormInput
            label="Anticipo efectivo Carlos"
            value={
              form.carlos_cash_advance
            }
            placeholder="$0.00"
            keyboardType="decimal-pad"
            onChangeText={(
              value
            ) =>
              updateForm(
                "carlos_cash_advance",
                value
              )
            }
          />

          <FormInput
            label="Pago factura Carlos"
            value={
              form.carlos_invoice_payment
            }
            placeholder="$0.00"
            keyboardType="decimal-pad"
            onChangeText={(
              value
            ) =>
              updateForm(
                "carlos_invoice_payment",
                value
              )
            }
          />

          <Text
            style={
              styles.section
            }
          >
            Observaciones
          </Text>

          <TextInput
            multiline
            value={
              form.observations
            }
            onChangeText={(
              value
            ) =>
              updateForm(
                "observations",
                value
              )
            }
            placeholder="Observaciones..."
            placeholderTextColor="#94a3b8"
            style={
              styles.textArea
            }
          />

          <Pressable
            disabled={
              saving
            }
            onPress={() =>
              void performSave()
            }
            style={[
              styles.saveButton,

              saving && {
                opacity:
                  0.6,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.saveText
                }
              >
                Guardar cambios
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={
          selector.visible
        }
        transparent
        animationType="slide"
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.sheet
            }
          >
            <View
              style={
                styles.sheetHeader
              }
            >
              <Text
                style={
                  styles.sheetTitle
                }
              >
                {
                  selector.title
                }
              </Text>

              <Pressable
                onPress={() =>
                  setSelector({
                    visible:
                      false,

                    title:
                      "",

                    field:
                      null,

                    catalogType:
                      null,
                  })
                }
              >
                <Text
                  style={
                    styles.close
                  }
                >
                  Cerrar
                </Text>
              </Pressable>
            </View>

            <ScrollView>
              {selectorOptions.map(
                (
                  option
                ) => (
                  <Pressable
                    key={
                      option.id
                    }
                    style={
                      styles.option
                    }
                    onPress={() =>
                      selectOption(
                        option.value
                      )
                    }
                  >
                    <Text
                      style={
                        styles.optionText
                      }
                    >
                      {
                        option.label
                      }
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CatalogField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress:
    () => void;
}) {
  return (
    <View
      style={
        styles.group
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <Pressable
        onPress={
          onPress
        }
        style={
          styles.select
        }
      >
        <Text
          style={
            value
              ? styles.selectText
              : styles.placeholder
          }
        >
          {value ||
            "Seleccionar"}
        </Text>

        <Text>
          ›
        </Text>
      </Pressable>
    </View>
  );
}

function FormInput({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText:
    (
      value:
        string
    ) => void;
  keyboardType?:
    | "default"
    | "decimal-pad";
}) {
  return (
    <View
      style={
        styles.group
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <TextInput
        value={
          value
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#94a3b8"
        keyboardType={
          keyboardType
        }
        onChangeText={
          onChangeText
        }
        style={
          styles.input
        }
      />
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

    loading: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 12,
      color:
        "#64748b",
    },

    container: {
      padding: 20,
      paddingBottom: 50,
    },

    back: {
      marginTop: 10,
      marginBottom: 22,
      color:
        "#64748b",
      fontSize: 16,
    },

    eyebrow: {
      color:
        "#2563eb",
      fontWeight:
        "700",
    },

    title: {
      marginTop: 6,
      color:
        "#0f172a",
      fontSize: 31,
      fontWeight:
        "800",
    },

    subtitle: {
      marginTop: 8,
      color:
        "#64748b",
    },

    section: {
      marginTop: 30,
      marginBottom: 14,
      color:
        "#0f172a",
      fontSize: 21,
      fontWeight:
        "800",
    },

    group: {
      marginBottom: 15,
    },

    label: {
      marginBottom: 7,
      color:
        "#475569",
      fontSize: 13,
      fontWeight:
        "700",
    },

    input: {
      height: 54,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 15,
      paddingHorizontal: 16,
      backgroundColor:
        "#ffffff",
      color:
        "#0f172a",
      fontSize: 16,
    },

    select: {
      height: 54,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 15,
      paddingHorizontal: 16,
      backgroundColor:
        "#ffffff",
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    selectText: {
      color:
        "#0f172a",
      fontSize: 16,
    },

    placeholder: {
      color:
        "#94a3b8",
      fontSize: 16,
    },

    textArea: {
      minHeight: 120,
      borderWidth: 1,
      borderColor:
        "#cbd5e1",
      borderRadius: 15,
      backgroundColor:
        "#ffffff",
      padding: 16,
      color:
        "#0f172a",
      fontSize: 16,
      textAlignVertical:
        "top",
    },

    saveButton: {
      marginTop: 28,
      height: 56,
      borderRadius: 15,
      backgroundColor:
        "#0f172a",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    saveText: {
      color:
        "#ffffff",
      fontSize: 16,
      fontWeight:
        "800",
    },

    overlay: {
      flex: 1,
      justifyContent:
        "flex-end",
      backgroundColor:
        "rgba(15,23,42,0.35)",
    },

    sheet: {
      maxHeight:
        "75%",
      backgroundColor:
        "#ffffff",
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      padding: 20,
    },

    sheetHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      marginBottom: 10,
    },

    sheetTitle: {
      fontSize: 21,
      fontWeight:
        "800",
    },

    close: {
      color:
        "#2563eb",
      fontWeight:
        "700",
    },

    option: {
      minHeight: 56,
      justifyContent:
        "center",
      borderBottomWidth:
        1,
      borderBottomColor:
        "#e2e8f0",
    },

    optionText: {
      color:
        "#0f172a",
      fontSize: 16,
      fontWeight:
        "600",
    },
  });