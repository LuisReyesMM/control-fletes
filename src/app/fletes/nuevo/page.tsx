"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

type Role =
  | "reader"
  | "editor"
  | "superuser";

type Profile = {
  id: string;
  role: Role;
  active: boolean;
};

type CustomField = {
  id: string;
  field_key: string;
  label: string;
  field_type:
    | "text"
    | "number"
    | "date"
    | "boolean";
  visible: boolean;
  required: boolean;
  sort_order: number;
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

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const initialForm: FormState = {
  service_date: localToday(),
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
};

function isValidDate(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  return (
    !Number.isNaN(
      date.getTime()
    ) &&
    date
      .toISOString()
      .slice(0, 10) ===
      value
  );
}

function parseOptionalNumber(
  value: string,
  label: string,
  {
    nonNegative = false,
  }: {
    nonNegative?: boolean;
  } = {}
): number | null {
  const normalized = value
    .replace(/,/g, "")
    .trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(
    normalized
  );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    throw new Error(
      `El campo "${label}" debe contener un número válido.`
    );
  }

  if (
    nonNegative &&
    parsed < 0
  ) {
    throw new Error(
      `El campo "${label}" no puede ser negativo.`
    );
  }

  return parsed;
}

export default function NuevoFletePage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    profile,
    setProfile,
  ] = useState<Profile | null>(
    null
  );

  const [
    form,
    setForm,
  ] = useState<FormState>(
    initialForm
  );

  const [
    customFields,
    setCustomFields,
  ] = useState<CustomField[]>(
    []
  );

  const [
    customValues,
    setCustomValues,
  ] = useState<
    Record<
      string,
      string | boolean
    >
  >({});

  const [
    catalogOptions,
    setCatalogOptions,
  ] = useState<CatalogOption[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    confirmOpen,
    setConfirmOpen,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successFolio,
    setSuccessFolio,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

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
          customResult,
          catalogResult,
        ] =
          await Promise.all([
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
              )
              .order(
                "created_at",
                {
                  ascending:
                    true,
                }
              ),

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
          ]);

        if (
          customResult.error
        ) {
          throw customResult.error;
        }

        if (
          catalogResult.error
        ) {
          throw catalogResult.error;
        }

        if (!mounted) {
          return;
        }

        const fields =
          (
            customResult.data ??
            []
          ) as CustomField[];

        const initialCustom:
          Record<
            string,
            string | boolean
          > = {};

        fields.forEach(
          (field) => {
            initialCustom[
              field.field_key
            ] =
              field.field_type ===
              "boolean"
                ? false
                : "";
          }
        );

        setProfile(
          profileData
        );
        setCustomFields(
          fields
        );
        setCustomValues(
          initialCustom
        );
        setCatalogOptions(
          (
            catalogResult.data ??
            []
          ) as CatalogOption[]
        );
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el formulario."
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
  }, [
    router,
    supabase,
  ]);

  function getCatalogOptions(
    catalogType:
      CatalogType
  ) {
    return catalogOptions.filter(
      (option) =>
        option.catalog_type ===
        catalogType
    );
  }

  function updateForm(
    field:
      keyof FormState,
    value: string
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  function updateCustomValue(
    fieldKey: string,
    value:
      | string
      | boolean
  ) {
    setCustomValues(
      (previous) => ({
        ...previous,
        [fieldKey]:
          value,
      })
    );
  }

  function validateForm() {
    if (
      !form.service_date.trim()
    ) {
      return "La fecha del servicio es obligatoria.";
    }

    if (
      !isValidDate(
        form.service_date
      )
    ) {
      return "La fecha del servicio no es válida.";
    }

    try {
      parseOptionalNumber(
        form.weight,
        "Peso",
        {
          nonNegative: true,
        }
      );

      parseOptionalNumber(
        form.rodrigo_cash_freight,
        "Flete Rodrigo",
        {
          nonNegative: true,
        }
      );

      parseOptionalNumber(
        form.invoice_freight,
        "Flete factura",
        {
          nonNegative: true,
        }
      );

      parseOptionalNumber(
        form.carlos_cash_advance,
        "Anticipo Carlos",
        {
          nonNegative: true,
        }
      );

      parseOptionalNumber(
        form.carlos_invoice_payment,
        "Pago Carlos",
        {
          nonNegative: true,
        }
      );

      for (
        const field of
        customFields
      ) {
        const value =
          customValues[
            field.field_key
          ];

        if (
          field.required &&
          field.field_type !==
            "boolean" &&
          String(
            value ?? ""
          ).trim() === ""
        ) {
          return `El campo "${field.label}" es obligatorio.`;
        }

        if (
          field.field_type ===
            "number" &&
          String(
            value ?? ""
          ).trim()
        ) {
          parseOptionalNumber(
            String(value),
            field.label
          );
        }

        if (
          field.field_type ===
            "date" &&
          String(
            value ?? ""
          ).trim() &&
          !isValidDate(
            String(value)
          )
        ) {
          return `El campo "${field.label}" contiene una fecha inválida.`;
        }
      }
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Revisa los valores numéricos.";
    }

    return null;
  }

  function requestSave(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validation =
      validateForm();

    if (validation) {
      setErrorMessage(
        validation
      );
      return;
    }

    setErrorMessage("");
    setConfirmOpen(true);
  }

  async function saveFreight() {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/login"
        );
        return;
      }

      const normalizedCustom:
        Record<
          string,
          unknown
        > = {};

      customFields.forEach(
        (field) => {
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
              parseOptionalNumber(
                String(
                  value ?? ""
                ),
                field.label
              );

            return;
          }

          normalizedCustom[
            field.field_key
          ] = value;
        }
      );

      const response =
        await fetch(
          "/api/fletes",
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
                  form.service_date.trim(),
                unit:
                  form.unit.trim(),
                invoice:
                  form.invoice.trim(),
                client:
                  form.client.trim(),
                service_type:
                  form.service_type.trim(),
                category:
                  form.category.trim(),
                container:
                  form.container.trim(),
                weight:
                  parseOptionalNumber(
                    form.weight,
                    "Peso",
                    {
                      nonNegative:
                        true,
                    }
                  ),
                destination:
                  form.destination.trim(),
                rodrigo_cash_freight:
                  parseOptionalNumber(
                    form.rodrigo_cash_freight,
                    "Flete Rodrigo",
                    {
                      nonNegative:
                        true,
                    }
                  ) ?? 0,
                invoice_freight:
                  parseOptionalNumber(
                    form.invoice_freight,
                    "Flete factura",
                    {
                      nonNegative:
                        true,
                    }
                  ) ?? 0,
                carlos_cash_advance:
                  parseOptionalNumber(
                    form.carlos_cash_advance,
                    "Anticipo Carlos",
                    {
                      nonNegative:
                        true,
                    }
                  ) ?? 0,
                carlos_invoice_payment:
                  parseOptionalNumber(
                    form.carlos_invoice_payment,
                    "Pago Carlos",
                    {
                      nonNegative:
                        true,
                    }
                  ) ?? 0,
                observations:
                  form.observations.trim(),
                custom_fields:
                  normalizedCustom,
              }),
          }
        );

      const responseText =
        await response.text();

      let data: {
        error?: string;
        folio?:
          | string
          | number;
      } = {};

      try {
        data =
          responseText
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        // La API no devolvió JSON.
      }

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ??
            `No se pudo crear el flete. Error ${response.status}.`
        );
      }

      setConfirmOpen(false);

      const rawFolio =
        data.folio;

      const formattedFolio =
        rawFolio ===
          undefined ||
        rawFolio === null
          ? "Flete creado"
          : String(
              rawFolio
            ).startsWith(
              "F-"
            )
            ? String(
                rawFolio
              )
            : `F-${String(
                rawFolio
              ).padStart(
                4,
                "0"
              )}`;

      setSuccessFolio(
        formattedFolio
      );
    } catch (error) {
      console.error(error);

      setConfirmOpen(false);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el flete."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargando formulario...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-6 py-5">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="mt-1 text-3xl leading-none text-blue-600 transition hover:-translate-x-1 hover:text-blue-700 dark:text-blue-400"
              aria-label="Volver a fletes"
            >
              ‹
            </button>

            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Relación de Fletes
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                Nuevo flete
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Captura la información del nuevo servicio.
              </p>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-7">
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={
            requestSave
          }
          className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h2 className="text-lg font-bold">
              Información del servicio
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Completa los datos del servicio. Los campos de fecha abren el calendario del navegador.
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Fecha"
              required
            >
              <input
                type="date"
                required
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
              />
            </Field>

            <Field label="Unidad">
              <CatalogSelect
                value={
                  form.unit
                }
                placeholder="Selecciona una unidad"
                options={getCatalogOptions(
                  "UNIT"
                )}
                onChange={(value) =>
                  updateForm(
                    "unit",
                    value
                  )
                }
              />
            </Field>

            <Field label="Factura">
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

            <Field label="Cliente">
              <CatalogSelect
                value={
                  form.client
                }
                placeholder="Selecciona un cliente"
                options={getCatalogOptions(
                  "CLIENT"
                )}
                onChange={(value) =>
                  updateForm(
                    "client",
                    value
                  )
                }
              />
            </Field>

            <Field label="Tipo">
              <CatalogSelect
                value={
                  form.service_type
                }
                placeholder="Selecciona un tipo"
                options={getCatalogOptions(
                  "SERVICE_TYPE"
                )}
                onChange={(value) =>
                  updateForm(
                    "service_type",
                    value
                  )
                }
              />
            </Field>

            <Field label="Categoría">
              <CatalogSelect
                value={
                  form.category
                }
                placeholder="Selecciona una categoría"
                options={getCatalogOptions(
                  "CATEGORY"
                )}
                onChange={(value) =>
                  updateForm(
                    "category",
                    value
                  )
                }
              />
            </Field>

            <Field label="Contenedor">
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

            <Field label="Peso">
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
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

            <Field label="Destino">
              <CatalogSelect
                value={
                  form.destination
                }
                placeholder="Selecciona un destino"
                options={getCatalogOptions(
                  "DESTINATION"
                )}
                onChange={(value) =>
                  updateForm(
                    "destination",
                    value
                  )
                }
              />
            </Field>
          </div>

          <div className="border-y border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            <h2 className="font-bold">
              Importes
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Los importes vacíos se guardan en $0.00.
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-4">
            <MoneyInput
              label="Flete Rodrigo"
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

            <MoneyInput
              label="Flete factura"
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

            <MoneyInput
              label="Anticipo Carlos"
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

            <MoneyInput
              label="Pago Carlos"
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
          </div>

          <div className="px-6 pb-6">
            <Field label="Observaciones">
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
                placeholder="Agrega observaciones del servicio..."
                className={`${inputClass} min-h-28 resize-y`}
              />
            </Field>
          </div>

          {customFields.length >
            0 && (
            <>
              <div className="border-y border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h2 className="font-bold">
                  Campos personalizados
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Información adicional configurada para los fletes.
                </p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
                {customFields.map(
                  (field) => (
                    <CustomFieldInput
                      key={
                        field.id
                      }
                      field={
                        field
                      }
                      value={
                        customValues[
                          field.field_key
                        ]
                      }
                      onChange={(
                        value
                      ) =>
                        updateCustomValue(
                          field.field_key,
                          value
                        )
                      }
                    />
                  )
                )}
              </div>
            </>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end dark:border-slate-800">
            <button
              type="button"
              disabled={
                saving
              }
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Guardar flete
            </button>
          </div>
        </form>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-[26px] border border-white/60 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
              ✓
            </div>

            <h2 className="mt-4 text-center text-xl font-bold tracking-tight">
              ¿Guardar este flete?
            </h2>

            <p className="mt-2 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">
              Se creará un nuevo registro y el movimiento quedará registrado en Auditoría.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  setConfirmOpen(
                    false
                  )
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  void saveFreight()
                }
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {saving
                  ? "Guardando..."
                  : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {successFolio && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-[26px] border border-emerald-100 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-emerald-950 dark:bg-slate-900"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xl font-bold text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              ✓
            </div>

            <h3 className="mt-4 text-xl font-bold tracking-tight">
              Flete creado
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {successFolio} se guardó correctamente.
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Movimiento registrado en Auditoría.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const selectClass =
  "w-full cursor-pointer appearance-auto rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function CatalogSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options:
    CatalogOption[];
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      className={
        selectClass
      }
    >
      <option value="">
        {placeholder}
      </option>

      {options.map(
        (option) => (
          <option
            key={
              option.id
            }
            value={
              option.value
            }
          >
            {option.label}
          </option>
        )
      )}
    </select>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <Field
      label={label}
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          $
        </span>

        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          placeholder="0.00"
          className={`${inputClass} pl-8`}
        />
      </div>
    </Field>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field:
    CustomField;
  value:
    | string
    | boolean
    | undefined;
  onChange: (
    value:
      | string
      | boolean
  ) => void;
}) {
  if (
    field.field_type ===
    "boolean"
  ) {
    return (
      <div>
        <span className="mb-2 block text-sm font-medium">
          {field.label}

          {field.required && (
            <span className="ml-1 text-red-500">
              *
            </span>
          )}
        </span>

        <label className="flex h-[46px] cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-4 dark:border-slate-700 dark:bg-slate-950">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {value === true
              ? "Sí"
              : "No"}
          </span>

          <input
            type="checkbox"
            checked={
              value === true
            }
            onChange={(event) =>
              onChange(
                event.target.checked
              )
            }
            className="h-5 w-5 accent-blue-600"
          />
        </label>
      </div>
    );
  }

  return (
    <Field
      label={
        field.label
      }
      required={
        field.required
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
        min={
          field.field_type ===
          "number"
            ? undefined
            : undefined
        }
        step={
          field.field_type ===
          "number"
            ? "any"
            : undefined
        }
        required={
          field.required
        }
        value={
          typeof value ===
          "string"
            ? value
            : ""
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
