"use client";

import {
  FormEvent,
  ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import ThemeToggle from "@/components/theme-toggle";

import {
  createClient,
} from "@/lib/supabase/client";

type Role =
  | "reader"
  | "editor"
  | "superuser";

type Profile = {
  id: string;
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

type MainColumnSetting = {
  column_key: string;
  label: string;
  visible: boolean;
  sort_order: number;
};

type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean";

type CustomFieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  visible: boolean;
  required: boolean;
  sort_order: number;
};

type FreightService = {
  id: string;
  folio: number;

  service_date: string;

  unit: string | null;
  invoice: string | null;
  client: string | null;
  service_type: string | null;
  category: string | null;
  container: string | null;

  weight: number | null;

  destination: string | null;

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

  custom_fields:
    Record<
      string,
      unknown
    > | null;
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

type CustomFieldValues =
  Record<string, string>;

const FALLBACK_MAIN_COLUMNS:
  MainColumnSetting[] = [
    {
      column_key: "service_date",
      label: "Fecha",
      visible: true,
      sort_order: 10,
    },
    {
      column_key: "unit",
      label: "Unidad",
      visible: true,
      sort_order: 20,
    },
    {
      column_key: "invoice",
      label: "Factura",
      visible: true,
      sort_order: 30,
    },
    {
      column_key: "client",
      label: "Cliente",
      visible: true,
      sort_order: 40,
    },
    {
      column_key: "service_type",
      label: "Tipo",
      visible: true,
      sort_order: 50,
    },
    {
      column_key: "category",
      label: "Categoría",
      visible: true,
      sort_order: 60,
    },
    {
      column_key: "container",
      label: "Contenedor",
      visible: true,
      sort_order: 70,
    },
    {
      column_key: "weight",
      label: "Peso",
      visible: true,
      sort_order: 80,
    },
    {
      column_key: "destination",
      label: "Destino",
      visible: true,
      sort_order: 90,
    },
    {
      column_key: "rodrigo_cash_freight",
      label: "Flete Rodrigo",
      visible: true,
      sort_order: 100,
    },
    {
      column_key: "invoice_freight",
      label: "Flete factura",
      visible: true,
      sort_order: 110,
    },
    {
      column_key: "carlos_cash_advance",
      label: "Anticipo Carlos",
      visible: true,
      sort_order: 120,
    },
    {
      column_key: "carlos_invoice_payment",
      label: "Pago Carlos",
      visible: true,
      sort_order: 130,
    },
    {
      column_key: "observations",
      label: "Observaciones",
      visible: true,
      sort_order: 140,
    },
  ];

const EDITABLE_MAIN_KEYS =
  new Set(
    FALLBACK_MAIN_COLUMNS.map(
      (column) =>
        column.column_key
    )
  );

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

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function customValueToString(
  value: unknown,
  type: CustomFieldType
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (type === "boolean") {
    if (
      value === true ||
      value === "true" ||
      value === 1 ||
      value === "1"
    ) {
      return "true";
    }

    if (
      value === false ||
      value === "false" ||
      value === 0 ||
      value === "0"
    ) {
      return "false";
    }

    return "";
  }

  return String(value);
}

function normalizeCustomValue(
  value: string,
  type: CustomFieldType
): string | number | boolean | null {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  if (type === "number") {
    return optionalNumber(
      trimmed
    );
  }

  if (type === "boolean") {
    if (
      trimmed === "true"
    ) {
      return true;
    }

    if (
      trimmed === "false"
    ) {
      return false;
    }

    return null;
  }

  return value;
}

export default function EditarFletePage({
  params,
}: {
  params:
    Promise<{
      id: string;
    }>;
}) {
  const {
    id,
  } = use(params);

  const router =
    useRouter();

  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    freight,
    setFreight,
  ] =
    useState<FreightService | null>(
      null
    );

  const [
    catalogOptions,
    setCatalogOptions,
  ] =
    useState<
      CatalogOption[]
    >([]);

  const [
    mainColumns,
    setMainColumns,
  ] =
    useState<
      MainColumnSetting[]
    >([]);

  const [
    customFieldDefinitions,
    setCustomFieldDefinitions,
  ] =
    useState<
      CustomFieldDefinition[]
    >([]);

  const [
    customFieldValues,
    setCustomFieldValues,
  ] =
    useState<CustomFieldValues>(
      {}
    );

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

  const [
    confirmOpen,
    setConfirmOpen,
  ] =
    useState(false);

  const [
    successOpen,
    setSuccessOpen,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

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
    });

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(
          true
        );

        setErrorMessage(
          ""
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
            "/login"
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
              "id, role, active"
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
          router.replace(
            "/login"
          );

          return;
        }

        if (
          profileData.role !==
            "editor" &&
          profileData.role !==
            "superuser"
        ) {
          router.replace(
            "/fletes"
          );

          return;
        }

        const [
          freightResult,
          catalogResult,
          mainColumnsResult,
          customFieldsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "freight_services"
              )
              .select("*")
              .eq(
                "id",
                id
              )
              .single(),

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

            supabase
              .from(
                "freight_column_settings"
              )
              .select(
                `
                column_key,
                label,
                visible,
                sort_order
                `
              )
              .order(
                "sort_order",
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
            "No se encontró el flete."
          );
        }

        if (
          catalogResult.error
        ) {
          throw catalogResult.error;
        }

        if (
          mainColumnsResult.error
        ) {
          throw new Error(
            `No se pudo cargar la configuración de campos: ${mainColumnsResult.error.message}`
          );
        }

        if (
          customFieldsResult.error
        ) {
          throw new Error(
            `No se pudieron cargar los campos personalizados: ${customFieldsResult.error.message}`
          );
        }

        if (!mounted) {
          return;
        }

        const service =
          freightResult.data as FreightService;

        const loadedMainColumns =
          (
            mainColumnsResult.data ??
            []
          ) as MainColumnSetting[];

        const loadedCustomFields =
          (
            customFieldsResult.data ??
            []
          ) as CustomFieldDefinition[];

        setProfile(
          profileData
        );

        setFreight(
          service
        );

        setCatalogOptions(
          (
            catalogResult.data ??
            []
          ) as CatalogOption[]
        );

        setMainColumns(
          loadedMainColumns.length
            ? loadedMainColumns
            : FALLBACK_MAIN_COLUMNS
        );

        setCustomFieldDefinitions(
          loadedCustomFields
        );

        const initialCustomValues:
          CustomFieldValues = {};

        for (
          const field
          of loadedCustomFields
        ) {
          initialCustomValues[
            field.field_key
          ] =
            customValueToString(
              service
                .custom_fields?.[
                  field.field_key
                ],
              field.field_type
            );
        }

        setCustomFieldValues(
          initialCustomValues
        );

        setForm({
          service_date:
            service.service_date ??
            "",

          unit:
            service.unit ??
            "",

          invoice:
            service.invoice ??
            "",

          client:
            service.client ??
            "",

          service_type:
            service.service_type ??
            "",

          category:
            service.category ??
            "",

          container:
            service.container ??
            "",

          weight:
            service.weight ===
              null ||
            service.weight ===
              undefined
              ? ""
              : String(
                  service.weight
                ),

          destination:
            service.destination ??
            "",

          rodrigo_cash_freight:
            String(
              service.rodrigo_cash_freight ??
                0
            ),

          invoice_freight:
            String(
              service.invoice_freight ??
                0
            ),

          carlos_cash_advance:
            String(
              service.carlos_cash_advance ??
                0
            ),

          carlos_invoice_payment:
            String(
              service.carlos_invoice_payment ??
                0
            ),

          observations:
            service.observations ??
            "",
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(
          error instanceof
          Error
            ? error.message
            : "No se pudo cargar el flete."
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
      mounted = false;
    };
  }, [
    id,
    router,
    supabase,
  ]);

  const visibleMainColumns =
    useMemo(
      () =>
        mainColumns
          .filter(
            (column) =>
              column.visible &&
              EDITABLE_MAIN_KEYS.has(
                column.column_key
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              a.sort_order -
              b.sort_order
          ),
      [
        mainColumns,
      ]
    );

  const visibleCustomFields =
    useMemo(
      () =>
        customFieldDefinitions
          .filter(
            (field) =>
              field.visible
          )
          .sort(
            (
              a,
              b
            ) =>
              a.sort_order -
              b.sort_order
          ),
      [
        customFieldDefinitions,
      ]
    );

  function updateForm(
    key:
      keyof FormState,

    value:
      string
  ) {
    setForm(
      (
        previous
      ) => ({
        ...previous,

        [key]:
          value,
      })
    );
  }

  function updateCustomField(
    fieldKey: string,
    value: string
  ) {
    setCustomFieldValues(
      (
        previous
      ) => ({
        ...previous,

        [fieldKey]:
          value,
      })
    );
  }

  function getCatalogOptions(
    catalogType:
      CatalogType,

    currentValue:
      string
  ) {
    const filtered =
      catalogOptions.filter(
        (
          option
        ) =>
          option.catalog_type ===
          catalogType
      );

    const currentExists =
      currentValue
        ? filtered.some(
            (
              option
            ) =>
              option.value ===
              currentValue
          )
        : true;

    if (
      currentValue &&
      !currentExists
    ) {
      return [
        {
          id:
            `current-${catalogType}-${currentValue}`,

          catalog_type:
            catalogType,

          value:
            currentValue,

          label:
            `${currentValue} (valor actual)`,

          active:
            false,

          sort_order:
            -1,
        },

        ...filtered,
      ];
    }

    return filtered;
  }

  function validateForm() {
    if (
      !form.service_date
    ) {
      return "La fecha es obligatoria.";
    }

    const numberFields: Array<{
      label: string;
      value: string;
    }> = [
      {
        label: "Peso",
        value: form.weight,
      },
      {
        label:
          "Flete Rodrigo",
        value:
          form.rodrigo_cash_freight,
      },
      {
        label:
          "Flete factura",
        value:
          form.invoice_freight,
      },
      {
        label:
          "Anticipo Carlos",
        value:
          form.carlos_cash_advance,
      },
      {
        label:
          "Pago Carlos",
        value:
          form.carlos_invoice_payment,
      },
    ];

    for (
      const field
      of numberFields
    ) {
      if (
        field.value.trim() &&
        optionalNumber(
          field.value
        ) === null
      ) {
        return `${field.label} debe contener un número válido.`;
      }
    }

    for (
      const field
      of customFieldDefinitions
    ) {
      const value =
        customFieldValues[
          field.field_key
        ] ?? "";

      if (
        field.required &&
        !value.trim()
      ) {
        return `${field.label} es obligatorio.`;
      }

      if (
        field.field_type ===
          "number" &&
        value.trim() &&
        optionalNumber(
          value
        ) === null
      ) {
        return `${field.label} debe contener un número válido.`;
      }
    }

    return "";
  }

  function requestSave(
    event:
      FormEvent
  ) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (
      validationError
    ) {
      setErrorMessage(
        validationError
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    setErrorMessage(
      ""
    );

    setConfirmOpen(
      true
    );
  }

  async function saveChanges() {
    try {
      setSaving(
        true
      );

      setErrorMessage(
        ""
      );

      const {
        data: {
          session,
        },

        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      const normalizedCustomFields:
        Record<
          string,
          string | number | boolean | null
        > = {
          ...(
            freight?.custom_fields ??
            {}
          ),
        } as Record<
          string,
          string | number | boolean | null
        >;

      for (
        const field
        of customFieldDefinitions
      ) {
        normalizedCustomFields[
          field.field_key
        ] =
          normalizeCustomValue(
            customFieldValues[
              field.field_key
            ] ?? "",
            field.field_type
          );
      }

      const response =
        await fetch(
          `/api/fletes/${id}`,
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

                custom_fields:
                  normalizedCustomFields,
              }),
          }
        );

      const responseText =
        await response.text();

      let data: {
        error?: string;
      } = {};

      try {
        data =
          responseText
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        // El servidor puede devolver
        // otro contenido inesperado.
      }

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ??
            `Error ${response.status}: ${responseText}`
        );
      }

      setConfirmOpen(
        false
      );

      setSuccessOpen(
        true
      );

      window.setTimeout(
        () => {
          router.push(
            "/fletes"
          );
        },
        1800
      );
    } catch (error) {
      setConfirmOpen(
        false
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "No se pudo actualizar."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  function renderMainField(
    column:
      MainColumnSetting
  ): ReactNode {
    const label =
      column.label;

    switch (
      column.column_key
    ) {
      case "service_date":
        return (
          <Field
            key={
              column.column_key
            }
            label={
              label
            }
          >
            <input
              type="date"
              value={
                form.service_date
              }
              onChange={(event) =>
                updateForm(
                  "service_date",
                  event.target.value
                )
              }
              className={
                inputClass
              }
              required
            />
          </Field>
        );

      case "unit":
        return (
          <CatalogField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.unit
            }
            options={getCatalogOptions(
              "UNIT",
              form.unit
            )}
            placeholder={`Seleccionar ${label.toLowerCase()}`}
            onChange={(value) =>
              updateForm(
                "unit",
                value
              )
            }
          />
        );

      case "invoice":
        return (
          <Field
            key={
              column.column_key
            }
            label={
              label
            }
          >
            <input
              type="text"
              value={
                form.invoice
              }
              onChange={(event) =>
                updateForm(
                  "invoice",
                  event.target.value
                )
              }
              className={
                inputClass
              }
            />
          </Field>
        );

      case "client":
        return (
          <CatalogField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.client
            }
            options={getCatalogOptions(
              "CLIENT",
              form.client
            )}
            placeholder={`Seleccionar ${label.toLowerCase()}`}
            onChange={(value) =>
              updateForm(
                "client",
                value
              )
            }
          />
        );

      case "service_type":
        return (
          <CatalogField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.service_type
            }
            options={getCatalogOptions(
              "SERVICE_TYPE",
              form.service_type
            )}
            placeholder={`Seleccionar ${label.toLowerCase()}`}
            onChange={(value) =>
              updateForm(
                "service_type",
                value
              )
            }
          />
        );

      case "category":
        return (
          <CatalogField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.category
            }
            options={getCatalogOptions(
              "CATEGORY",
              form.category
            )}
            placeholder={`Seleccionar ${label.toLowerCase()}`}
            onChange={(value) =>
              updateForm(
                "category",
                value
              )
            }
          />
        );

      case "container":
        return (
          <Field
            key={
              column.column_key
            }
            label={
              label
            }
          >
            <input
              type="text"
              value={
                form.container
              }
              onChange={(event) =>
                updateForm(
                  "container",
                  event.target.value
                )
              }
              className={
                inputClass
              }
            />
          </Field>
        );

      case "weight":
        return (
          <Field
            key={
              column.column_key
            }
            label={
              label
            }
          >
            <input
              type="number"
              step="any"
              value={
                form.weight
              }
              onChange={(event) =>
                updateForm(
                  "weight",
                  event.target.value
                )
              }
              className={
                inputClass
              }
            />
          </Field>
        );

      case "destination":
        return (
          <CatalogField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.destination
            }
            options={getCatalogOptions(
              "DESTINATION",
              form.destination
            )}
            placeholder={`Seleccionar ${label.toLowerCase()}`}
            onChange={(value) =>
              updateForm(
                "destination",
                value
              )
            }
          />
        );

      case "rodrigo_cash_freight":
        return (
          <NumberField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.rodrigo_cash_freight
            }
            onChange={(value) =>
              updateForm(
                "rodrigo_cash_freight",
                value
              )
            }
          />
        );

      case "invoice_freight":
        return (
          <NumberField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.invoice_freight
            }
            onChange={(value) =>
              updateForm(
                "invoice_freight",
                value
              )
            }
          />
        );

      case "carlos_cash_advance":
        return (
          <NumberField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.carlos_cash_advance
            }
            onChange={(value) =>
              updateForm(
                "carlos_cash_advance",
                value
              )
            }
          />
        );

      case "carlos_invoice_payment":
        return (
          <NumberField
            key={
              column.column_key
            }
            label={
              label
            }
            value={
              form.carlos_invoice_payment
            }
            onChange={(value) =>
              updateForm(
                "carlos_invoice_payment",
                value
              )
            }
          />
        );

      case "observations":
        return (
          <div
            key={
              column.column_key
            }
            className="md:col-span-2 xl:col-span-3"
          >
            <Field
              label={
                label
              }
            >
              <textarea
                rows={4}
                value={
                  form.observations
                }
                onChange={(event) =>
                  updateForm(
                    "observations",
                    event.target.value
                  )
                }
                className={`${inputClass} min-h-28 resize-y`}
              />
            </Field>
          </div>
        );

      default:
        return null;
    }
  }

  function renderCustomField(
    field:
      CustomFieldDefinition
  ) {
    const value =
      customFieldValues[
        field.field_key
      ] ?? "";

    if (
      field.field_type ===
        "boolean"
    ) {
      return (
        <Field
          key={
            field.id
          }
          label={
            field.label
          }
        >
          <select
            value={
              value
            }
            onChange={(event) =>
              updateCustomField(
                field.field_key,
                event.target.value
              )
            }
            required={
              field.required
            }
            className={
              inputClass
            }
          >
            <option value="">
              Seleccionar
            </option>

            <option value="true">
              Sí
            </option>

            <option value="false">
              No
            </option>
          </select>
        </Field>
      );
    }

    return (
      <Field
        key={
          field.id
        }
        label={
          field.label
        }
      >
        <input
          type={
            field.field_type ===
              "number"
              ? "number"
              : field.field_type ===
                  "date"
                ? "date"
                : "text"
          }
          step={
            field.field_type ===
              "number"
              ? "any"
              : undefined
          }
          value={
            value
          }
          onChange={(event) =>
            updateCustomField(
              field.field_key,
              event.target.value
            )
          }
          required={
            field.required
          }
          className={
            inputClass
          }
        />
      </Field>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
        Cargando...
      </main>
    );
  }

  if (
    !profile ||
    !freight
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300">
            No se pudo cargar el
            flete.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/fletes"
              )
            }
            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-white dark:bg-white dark:text-slate-900"
          >
            Volver
          </button>
        </div>
      </main>
    );
  }

  const folio =
    `F-${String(
      freight.folio
    ).padStart(
      4,
      "0"
    )}`;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-white">
      <header className="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="text-3xl text-slate-500 transition hover:text-slate-900 dark:hover:text-white"
            >
              ←
            </button>

            <div>
              <p className="text-sm font-medium text-blue-600">
                {folio}
              </p>

              <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
                Editar flete
              </h1>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-6">
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={
            requestSave
          }
          className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleMainColumns.map(
              (
                column
              ) =>
                renderMainField(
                  column
                )
            )}

            {visibleCustomFields.map(
              (
                field
              ) =>
                renderCustomField(
                  field
                )
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t p-6 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl dark:bg-slate-900">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              ¿Guardar cambios?
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Se actualizará el flete{" "}
              <strong>
                {folio}
              </strong>
              .
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmOpen(
                    false
                  )
                }
                disabled={
                  saving
                }
                className="rounded-xl border border-slate-300 px-5 py-3 dark:border-slate-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveChanges()
                }
                disabled={
                  saving
                }
                className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {saving
                  ? "Guardando..."
                  : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {successOpen && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4">
          <div className="rounded-2xl bg-white p-7 text-center shadow-2xl dark:bg-slate-900">
            <div className="text-4xl text-emerald-600">
              ✓
            </div>

            <h3 className="mt-3 text-xl font-bold">
              Cambios guardados
            </h3>

            <p className="mt-2 text-slate-500">
              {folio}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Field({
  label,
  children,
}: {
  label: string;

  children:
    ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>

      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange:
    (
      value: string
    ) => void;
}) {
  return (
    <Field
      label={
        label
      }
    >
      <input
        type="number"
        step="any"
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className={
          inputClass
        }
      />
    </Field>
  );
}

function CatalogField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;

  value: string;

  options:
    CatalogOption[];

  placeholder:
    string;

  onChange:
    (
      value:
        string
    ) => void;
}) {
  return (
    <Field
      label={
        label
      }
    >
      <select
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className={
          inputClass
        }
      >
        <option value="">
          {placeholder}
        </option>

        {options.map(
          (
            option
          ) => (
            <option
              key={
                option.id
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          )
        )}
      </select>
    </Field>
  );
}
