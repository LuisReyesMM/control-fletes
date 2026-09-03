import {
  useEffect,
  useMemo,
  useRef,
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  router,
  type Href,
} from "expo-router";

import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

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

  role:
    Role;

  active:
    boolean;
};

type CatalogType =
  | "UNIT"
  | "CLIENT"
  | "SERVICE_TYPE"
  | "CATEGORY"
  | "DESTINATION";

type CatalogOption = {
  id: string;

  catalog_type:
    CatalogType;

  value:
    string;

  label:
    string;

  active:
    boolean;

  sort_order:
    number;
};

type CustomField = {
  id: string;

  field_key:
    string;

  label:
    string;

  field_type:
    | "text"
    | "number"
    | "date"
    | "boolean";

  visible:
    boolean;

  required:
    boolean;

  sort_order:
    number;
};

type FormState = {
  service_date:
    string;

  unit:
    string;

  invoice:
    string;

  client:
    string;

  service_type:
    string;

  category:
    string;

  container:
    string;

  weight:
    string;

  destination:
    string;

  rodrigo_cash_freight:
    string;

  invoice_freight:
    string;

  carlos_cash_advance:
    string;

  carlos_invoice_payment:
    string;

  observations:
    string;
};

type SelectorState = {
  visible:
    boolean;

  title:
    string;

  field:
    keyof FormState | null;

  catalogType:
    CatalogType | null;
};

const LOGIN_ROUTE =
  "/login" as Href;

const FLETES_ROUTE =
  "/fletes" as Href;

function getToday() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const initialForm: FormState = {
  service_date:
    getToday(),

  unit:
    "",

  invoice:
    "",

  client:
    "",

  service_type:
    "",

  category:
    "",

  container:
    "",

  weight:
    "",

  destination:
    "",

  rodrigo_cash_freight:
    "",

  invoice_freight:
    "",

  carlos_cash_advance:
    "",

  carlos_invoice_payment:
    "",

  observations:
    "",
};

function optionalNumber(
  value: string
): number | null {
  const normalized =
    value
      .replace(
        /,/g,
        ""
      )
      .trim();

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(
      normalized
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return parsed;
}

export default function NuevoFleteScreen() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const scrollRef =
    useRef<ScrollView | null>(null);

  const [
    showDatePicker,
    setShowDatePicker,
  ] = useState(false);

  const [
    confirmVisible,
    setConfirmVisible,
  ] = useState(false);

  const [
    feedbackVisible,
    setFeedbackVisible,
  ] = useState(false);

  const [
    feedbackTitle,
    setFeedbackTitle,
  ] = useState("");

  const [
    feedbackMessage,
    setFeedbackMessage,
  ] = useState("");

  const [
    profile,
    setProfile,
  ] =
    useState<
      Profile | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      initialForm
    );

  const [
    catalogOptions,
    setCatalogOptions,
  ] =
    useState<
      CatalogOption[]
    >([]);

  const [
    customFields,
    setCustomFields,
  ] =
    useState<
      CustomField[]
    >([]);

  const [
    customValues,
    setCustomValues,
  ] =
    useState<
      Record<
        string,
        string | boolean
      >
    >({});

  const [
    selector,
    setSelector,
  ] =
    useState<SelectorState>({
      visible:
        false,

      title:
        "",

      field:
        null,

      catalogType:
        null,
    });

  useEffect(() => {
    let mounted =
      true;

    async function loadData() {
      try {
        setLoading(
          true
        );

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
              id,
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

        if (
          profileData.role !==
            "editor" &&
          profileData.role !==
            "superuser"
        ) {
          Alert.alert(
            "Sin permisos",
            "Tu usuario no tiene permisos para crear fletes."
          );

          router.replace(
            FLETES_ROUTE
          );

          return;
        }

        const [
          catalogResult,
          customResult,
        ] =
          await Promise.all([
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
              )
              .order(
                "label",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "freight_custom_fields"
              )
              .select(
                `
                id,
                field_key,
                label,
                field_type,
                visible,
                required,
                sort_order
                `
              )
              .eq(
                "visible",
                true
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
          catalogResult.error
        ) {
          throw catalogResult.error;
        }

        if (
          customResult.error
        ) {
          throw customResult.error;
        }

        if (!mounted) {
          return;
        }

        setProfile(
          profileData
        );

        setCatalogOptions(
          (
            catalogResult.data ??
            []
          ) as CatalogOption[]
        );

        const fields =
          (
            customResult.data ??
            []
          ) as CustomField[];

        setCustomFields(
          fields
        );

        const initialCustomValues:
          Record<
            string,
            string | boolean
          > = {};

        fields.forEach(
          (
            field
          ) => {
            initialCustomValues[
              field.field_key
            ] =
              field.field_type ===
              "boolean"
                ? false
                : "";
          }
        );

        setCustomValues(
          initialCustomValues
        );
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo cargar el formulario."
        );
      } finally {
        if (mounted) {
          setLoading(
            false
          );
        }
      }
    }

    void loadData();

    return () => {
      mounted =
        false;
    };
  }, []);

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

    value:
      string
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
    title:
      string,

    field:
      keyof FormState,

    catalogType:
      CatalogType
  ) {
    setSelector({
      visible:
        true,

      title,

      field,

      catalogType,
    });
  }

  function selectOption(
    value:
      string
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
      visible:
        false,

      title:
        "",

      field:
        null,

      catalogType:
        null,
    });
  }

  function updateCustomValue(
    fieldKey:
      string,

    value:
      string | boolean
  ) {
    setCustomValues(
      (
        previous
      ) => ({
        ...previous,

        [fieldKey]:
          value,
      })
    );
  }

  function scrollToBottomField() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 140);
  }

  function validateForm() {
    if (
      !form.service_date.trim()
    ) {
      return "La fecha del servicio es obligatoria.";
    }

    const dateRegex =
      /^\d{4}-\d{2}-\d{2}$/;

    if (
      !dateRegex.test(
        form.service_date
      )
    ) {
      return "La fecha debe tener formato AAAA-MM-DD.";
    }

    for (
      const field of
      customFields
    ) {
      if (
        !field.required
      ) {
        continue;
      }

      if (
        field.field_type ===
        "boolean"
      ) {
        continue;
      }

      const value =
        customValues[
          field.field_key
        ];

      if (
        value ===
          undefined ||
        value ===
          null ||
        String(
          value
        ).trim() === ""
      ) {
        return `El campo "${field.label}" es obligatorio.`;
      }
    }

    return null;
  }

  function saveFreight() {
    if (saving) {
      return;
    }

    const validation =
      validateForm();

    if (validation) {
      Alert.alert(
        "Revisa el formulario",
        validation
      );
      return;
    }

    setConfirmVisible(true);
  }

  async function performSave() {
    try {
      setSaving(
        true
      );

     const session =
  await getFreshSession();

      const normalizedCustom:
        Record<
          string,
          unknown
        > = {};

      customFields.forEach(
        (
          field
        ) => {
          const value =
            customValues[
              field.field_key
            ];

          if (
            field.field_type ===
            "number"
          ) {
            normalizedCustom[
              field.field_key
            ] =
              typeof value ===
                "string"
                ? optionalNumber(
                    value
                  )
                : null;

            return;
          }

          normalizedCustom[
            field.field_key
          ] =
            value;
        }
      );

      const apiUrl =
        process.env
          .EXPO_PUBLIC_API_URL;

      if (
        !apiUrl
      ) {
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
          `${baseUrl}/api/fletes`,
          {
            method:
              "POST",

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

                custom_fields:
                  normalizedCustom,
              }),
          }
        );

      const responseText =
  await response.text();

let result: {
  error?: string;
  folio?: string;
  [key: string]: unknown;
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
    "Respuesta no JSON:",
    responseText
  );
}

if (!response.ok) {
  console.log(
    "Error API fletes:",
    {
      status:
        response.status,

      statusText:
        response.statusText,

      body:
        responseText,
    }
  );

  throw new Error(
    typeof result.error ===
      "string"
      ? result.error
      : `Error ${response.status}: ${
          responseText
            ? responseText.slice(
                0,
                180
              )
            : "La API no devolvió detalles."
        }`
  );
}

     const folio =
  typeof result.folio ===
    "string" ||
  typeof result.folio ===
    "number"
    ? String(
        result.folio
      )
    : "nuevo";

      setFeedbackTitle(
        "Flete creado"
      );
      setFeedbackMessage(
        `El flete ${folio} se guardó correctamente.`
      );
      setFeedbackVisible(true);
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error
          ? error.message
          : "Ocurrió un error."
      );
    } finally {
      setSaving(
        false
      );
    }
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
          Preparando formulario...
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
        style={
          styles.flex
        }
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : "height"
        }
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={
            styles.container
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={
            false
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
              ← Relación de Fletes
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
            Nuevo flete
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Captura los datos del
            servicio.
          </Text>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Servicio
          </Text>

          <View
            style={
              styles.fieldGroup
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Fecha
            </Text>

            <Pressable
              onPress={() =>
                setShowDatePicker(
                  true
                )
              }
              style={({ pressed }) => [
                styles.selectInput,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.selectValue
                }
              >
                {form.service_date ||
                  "Seleccionar fecha"}
              </Text>

              <Ionicons
                name="calendar-outline"
                size={21}
                color="#007AFF"
              />
            </Pressable>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={
                form.service_date
                  ? parseInputDate(
                      form.service_date
                    )
                  : new Date()
              }
              mode="date"
              display={
                Platform.OS === "ios"
                  ? "spinner"
                  : "default"
              }
              onChange={(
                _event,
                selectedDate
              ) => {
                setShowDatePicker(
                  false
                );

                if (selectedDate) {
                  updateForm(
                    "service_date",
                    formatDateForInput(
                      selectedDate
                    )
                  );
                }
              }}
            />
          )}

          <CatalogField
            label="Unidad"
            value={
              form.unit
            }
            placeholder="Seleccionar unidad"
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
            placeholder="Seleccionar cliente"
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
            placeholder="Seleccionar tipo"
            onPress={() =>
              openSelector(
                "Tipo de servicio",
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
            placeholder="Seleccionar categoría"
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
            placeholder="Número de contenedor"
            autoCapitalize="characters"
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
            placeholder="Seleccionar destino"
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
              styles.sectionTitle
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
            }            onFocus={
              scrollToBottomField
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
            }            onFocus={
              scrollToBottomField
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
            }            onFocus={
              scrollToBottomField
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
            }            onFocus={
              scrollToBottomField
            }
          />

          {customFields.length >
            0 && (
            <>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Campos adicionales
              </Text>

              {customFields.map(
                (
                  field
                ) => {
                  const value =
                    customValues[
                      field.field_key
                    ];

                  if (
                    field.field_type ===
                    "boolean"
                  ) {
                    return (
                      <View
                        key={
                          field.id
                        }
                        style={
                          styles.switchCard
                        }
                      >
                        <View
                          style={
                            styles.switchTextContainer
                          }
                        >
                          <Text
                            style={
                              styles.label
                            }
                          >
                            {
                              field.label
                            }
                            {field.required
                              ? " *"
                              : ""}
                          </Text>
                        </View>

                        <Switch
                          value={
                            Boolean(
                              value
                            )
                          }
                          onValueChange={(
                            nextValue
                          ) =>
                            updateCustomValue(
                              field.field_key,
                              nextValue
                            )
                          }
                        />
                      </View>
                    );
                  }

                  return (
                    <FormInput
                      key={
                        field.id
                      }
                      label={`${field.label}${field.required ? " *" : ""}`}
                      value={
                        typeof value ===
                        "string"
                          ? value
                          : ""
                      }
                      keyboardType={
                        field.field_type ===
                        "number"
                          ? "decimal-pad"
                          : "default"
                      }
                      placeholder={
                        field.field_type ===
                        "date"
                          ? "AAAA-MM-DD"
                          : field.label
                      }
                      onChangeText={(
                        nextValue
                      ) =>
                        updateCustomValue(
                          field.field_key,
                          nextValue
                        )
                      }
                      onFocus={scrollToBottomField}
                    />
                  );
                }
              )}
            </>
          )}

          <Text
            style={
              styles.sectionTitle
            }
          >
            Observaciones
          </Text>

          <TextInput
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
            placeholder="Agrega comentarios u observaciones..."
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
            style={
              styles.textArea
            }
            onFocus={
              scrollToBottomField
            }
          />

          <Pressable
            disabled={
              saving
            }
            onPress={() =>
              void saveFreight()
            }
            style={({
              pressed,
            }) => [
              styles.saveButton,

              pressed &&
                styles.pressed,

              saving &&
                styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.saveButtonText
                }
              >
                Guardar flete
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled={
              saving
            }
            onPress={() =>
              router.back()
            }
            style={
              styles.cancelButton
            }
          >
            <Text
              style={
                styles.cancelButtonText
              }
            >
              Cancelar
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setConfirmVisible(false)
        }
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              <Text style={styles.dialogIcon}>✓</Text>
            </View>
            <Text style={styles.dialogTitle}>Guardar flete</Text>
            <Text style={styles.dialogMessage}>
              ¿Deseas crear este flete con la información capturada?
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogSecondary}
                onPress={() =>
                  setConfirmVisible(false)
                }
              >
                <Text style={styles.dialogSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.dialogPrimary}
                onPress={() => {
                  setConfirmVisible(false);
                  void performSave();
                }}
              >
                <Text style={styles.dialogPrimaryText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setFeedbackVisible(false)
        }
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.feedbackCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.dialogTitle}>{feedbackTitle}</Text>
            <Text style={styles.dialogMessage}>{feedbackMessage}</Text>
            <Pressable
              style={styles.feedbackButton}
              onPress={() => {
                setFeedbackVisible(false);
                router.replace(FLETES_ROUTE);
              }}
            >
              <Text style={styles.dialogPrimaryText}>Aceptar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={
          selector.visible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
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
        <View
          style={
            styles.modalBackdrop
          }
        >
          <View
            style={
              styles.selectorSheet
            }
          >
            <View
              style={
                styles.selectorHeader
              }
            >
              <Text
                style={
                  styles.selectorTitle
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
                    styles.selectorClose
                  }
                >
                  Cerrar
                </Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              <Pressable
                onPress={() =>
                  selectOption(
                    ""
                  )
                }
                style={
                  styles.optionRow
                }
              >
                <Text
                  style={
                    styles.optionEmpty
                  }
                >
                  Sin seleccionar
                </Text>
              </Pressable>

              {selectorOptions.map(
                (
                  option
                ) => (
                  <Pressable
                    key={
                      option.id
                    }
                    onPress={() =>
                      selectOption(
                        option.value
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.optionRow,

                      pressed &&
                        styles.pressed,
                    ]}
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

              {selectorOptions.length ===
                0 && (
                <Text
                  style={
                    styles.noOptions
                  }
                >
                  No hay opciones
                  disponibles.
                </Text>
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
  placeholder,
  onPress,
}: {
  label:
    string;

  value:
    string;

  placeholder:
    string;

  onPress:
    () => void;
}) {
  return (
    <View
      style={
        styles.fieldGroup
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
        style={({
          pressed,
        }) => [
          styles.selectInput,

          pressed &&
            styles.pressed,
        ]}
      >
        <Text
          numberOfLines={
            1
          }
          style={[
            styles.selectValue,

            !value &&
              styles.placeholderText,
          ]}
        >
          {value ||
            placeholder}
        </Text>

        <Text
          style={
            styles.chevron
          }
        >
          ›
        </Text>
      </Pressable>
    </View>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
  onFocus,
}: {
  label:
    string;

  value:
    string;

  onChangeText:
    (
      value:
        string
    ) => void;

  placeholder:
    string;

  keyboardType?:
    | "default"
    | "numeric"
    | "decimal-pad"
    | "number-pad"
    | "phone-pad"
    | "email-address"
    | "numbers-and-punctuation";

  autoCapitalize?:
    | "none"
    | "sentences"
    | "words"
    | "characters";

  onFocus?:
    () => void;
}) {
  return (
    <View
      style={
        styles.fieldGroup
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
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#94a3b8"
        keyboardType={
          keyboardType
        }
        autoCapitalize={
          autoCapitalize
        }
        onFocus={
          onFocus
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
    flex: {
      flex: 1,
    },

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

    container: {
      paddingHorizontal:
        20,

      paddingBottom:
        140,
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
        32,

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

    sectionTitle: {
      marginTop:
        30,

      marginBottom:
        14,

      color:
        "#0f172a",

      fontSize:
        21,

      fontWeight:
        "800",
    },

    fieldGroup: {
      marginBottom:
        16,
    },

    label: {
      marginBottom:
        7,

      color:
        "#475569",

      fontSize:
        13,

      fontWeight:
        "700",
    },

    input: {
      height:
        54,

      borderWidth:
        1,

      borderColor:
        "#cbd5e1",

      borderRadius:
        15,

      paddingHorizontal:
        16,

      backgroundColor:
        "#ffffff",

      color:
        "#0f172a",

      fontSize:
        16,
    },

    selectInput: {
      height:
        54,

      borderWidth:
        1,

      borderColor:
        "#cbd5e1",

      borderRadius:
        15,

      paddingHorizontal:
        16,

      backgroundColor:
        "#ffffff",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    selectValue: {
      flex: 1,

      color:
        "#0f172a",

      fontSize:
        16,
    },

    placeholderText: {
      color:
        "#94a3b8",
    },

    chevron: {
      marginLeft:
        10,

      color:
        "#64748b",

      fontSize:
        28,

      lineHeight:
        28,
    },

    textArea: {
      minHeight:
        130,

      borderWidth:
        1,

      borderColor:
        "#cbd5e1",

      borderRadius:
        15,

      padding:
        16,

      backgroundColor:
        "#ffffff",

      color:
        "#0f172a",

      fontSize:
        16,

      lineHeight:
        22,
    },

    switchCard: {
      marginBottom:
        16,

      minHeight:
        64,

      borderWidth:
        1,

      borderColor:
        "#e2e8f0",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      paddingHorizontal:
        16,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    switchTextContainer: {
      flex: 1,

      paddingRight:
        12,
    },

    saveButton: {
      marginTop:
        30,

      height:
        56,

      borderRadius:
        15,

      backgroundColor:
        "#0f172a",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    saveButtonText: {
      color:
        "#ffffff",

      fontSize:
        16,

      fontWeight:
        "800",
    },

    cancelButton: {
      marginTop:
        12,

      height:
        54,

      borderWidth:
        1,

      borderColor:
        "#cbd5e1",

      borderRadius:
        15,

      backgroundColor:
        "#ffffff",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    cancelButtonText: {
      color:
        "#475569",

      fontSize:
        15,

      fontWeight:
        "700",
    },

    disabledButton: {
      opacity:
        0.6,
    },

    pressed: {
      opacity:
        0.75,
    },

    dialogOverlay: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.30)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },

    dialogCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: "#ffffff",
      padding: 22,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    feedbackCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: "#ffffff",
      padding: 24,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      alignItems: "center",
    },

    dialogIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#EFF6FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },

    dialogIcon: {
      color: "#2563EB",
      fontSize: 22,
      fontWeight: "800",
    },

    successCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "#ECFDF3",
      borderWidth: 1,
      borderColor: "#A7DDB8",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },

    successCheck: {
      color: "#258044",
      fontSize: 27,
      fontWeight: "800",
    },

    dialogTitle: {
      color: "#0F172A",
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
    },

    dialogMessage: {
      marginTop: 9,
      color: "#64748B",
      fontSize: 15,
      lineHeight: 21,
      textAlign: "center",
    },

    dialogActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 22,
    },

    dialogSecondary: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ffffff",
    },

    dialogSecondaryText: {
      color: "#475569",
      fontSize: 15,
      fontWeight: "700",
    },

    dialogPrimary: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      backgroundColor: "#0F172A",
      alignItems: "center",
      justifyContent: "center",
    },

    feedbackButton: {
      alignSelf: "stretch",
      height: 48,
      marginTop: 22,
      borderRadius: 14,
      backgroundColor: "#0F172A",
      alignItems: "center",
      justifyContent: "center",
    },

    dialogPrimaryText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "800",
    },

    modalBackdrop: {
      flex:
        1,

      justifyContent:
        "flex-end",

      backgroundColor:
        "rgba(15,23,42,0.35)",
    },

    selectorSheet: {
      maxHeight:
        "75%",

      borderTopLeftRadius:
        24,

      borderTopRightRadius:
        24,

      backgroundColor:
        "#ffffff",

      paddingHorizontal:
        20,

      paddingTop:
        20,

      paddingBottom:
        30,
    },

    selectorHeader: {
      marginBottom:
        10,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    selectorTitle: {
      color:
        "#0f172a",

      fontSize:
        22,

      fontWeight:
        "800",
    },

    selectorClose: {
      color:
        "#2563eb",

      fontSize:
        15,

      fontWeight:
        "700",
    },

    optionRow: {
      minHeight:
        58,

      borderBottomWidth:
        1,

      borderBottomColor:
        "#e2e8f0",

      justifyContent:
        "center",

      paddingVertical:
        10,
    },

    optionText: {
      color:
        "#0f172a",

      fontSize:
        16,

      fontWeight:
        "600",
    },

    optionEmpty: {
      color:
        "#94a3b8",

      fontSize:
        16,
    },

    noOptions: {
      paddingVertical:
        30,

      color:
        "#64748b",

      textAlign:
        "center",

      fontSize:
        15,
    },
  });