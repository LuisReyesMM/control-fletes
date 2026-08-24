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

const initialForm: FormState = {
  service_date:
    new Date()
      .toISOString()
      .slice(0, 10),

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

function optionalNumber(
  value: string
): number | null {
  if (
    value.trim() === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

export default function NuevoFletePage() {
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
    form,
    setForm,
  ] =
    useState<FormState>(
      initialForm
    );

  const [
    customFields,
    setCustomFields,
  ] =
    useState<CustomField[]>(
      []
    );

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
    catalogOptions,
    setCatalogOptions,
  ] =
    useState<CatalogOption[]>(
      []
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
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successFolio,
    setSuccessFolio,
  ] =
    useState<string | null>(
      null
    );

  // ============================================================
  // CARGAR INFORMACIÓN
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

        // ======================================================
        // USUARIO
        // ======================================================

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

        // ======================================================
        // PERFIL
        // ======================================================

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

        // ======================================================
        // CAMPOS PERSONALIZADOS
        // ======================================================

        const {
          data:
            customData,
          error:
            customError,
        } =
          await supabase
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
            );

        if (
          customError
        ) {
          throw customError;
        }

        // ======================================================
        // CATÁLOGOS
        // ======================================================

        const {
          data:
            catalogData,
          error:
            catalogError,
        } =
          await supabase
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
            );

        if (
          catalogError
        ) {
          throw catalogError;
        }

        if (!mounted) {
          return;
        }

        setProfile(
          profileData
        );

        const fields =
          (customData ??
            []) as CustomField[];

        setCustomFields(
          fields
        );

        setCatalogOptions(
          (catalogData ??
            []) as CatalogOption[]
        );

        // ======================================================
        // VALORES INICIALES DE CAMPOS PERSONALIZADOS
        // ======================================================

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

        setCustomValues(
          initialCustom
        );
      } catch (error) {
        console.error(
          error
        );

        setErrorMessage(
          error instanceof
          Error
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
      mounted = false;
    };
  }, [
    router,
    supabase,
  ]);

  // ============================================================
  // CATÁLOGOS
  // ============================================================

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

  // ============================================================
  // ACTUALIZAR FORMULARIO
  // ============================================================

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
    fieldKey:
      string,
    value:
      string | boolean
  ) {
    setCustomValues(
      (previous) => ({
        ...previous,
        [fieldKey]:
          value,
      })
    );
  }

  // ============================================================
  // VALIDACIÓN
  // ============================================================

  function validateForm() {
    if (
      !form.service_date.trim()
    ) {
      return "La fecha del servicio es obligatoria.";
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
        value === null ||
        String(
          value
        ).trim() === ""
      ) {
        return `El campo "${field.label}" es obligatorio.`;
      }
    }

    return null;
  }

  // ============================================================
  // SOLICITAR GUARDADO
  // ============================================================

  function requestSave(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validation =
      validateForm();

    if (
      validation
    ) {
      setErrorMessage(
        validation
      );

      return;
    }

    setErrorMessage("");
    setConfirmOpen(true);
  }

  // ============================================================
  // CREAR FLETE
  // ============================================================

  async function saveFreight() {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      // ======================================================
      // SESIÓN
      // ======================================================

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

      // ======================================================
      // CAMPOS PERSONALIZADOS
      // ======================================================

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
              value === ""
                ? null
                : Number(
                    value
                  );

            return;
          }

          normalizedCustom[
            field.field_key
          ] = value;
        }
      );

      // ======================================================
      // API
      // ======================================================

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
                  ),

                invoice_freight:
                  optionalNumber(
                    form.invoice_freight
                  ),

                carlos_cash_advance:
                  optionalNumber(
                    form.carlos_cash_advance
                  ),

                carlos_invoice_payment:
                  optionalNumber(
                    form.carlos_invoice_payment
                  ),

                observations:
                  form.observations,

                custom_fields:
                  normalizedCustom,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ??
            "No se pudo crear el flete."
        );
      }

      // ======================================================
      // ÉXITO
      // ======================================================

      setConfirmOpen(false);

      setSuccessFolio(
        data.folio ??
          "Flete creado"
      );

      window.setTimeout(
        () => {
          router.push(
            "/fletes"
          );
        },
        3000
      );
    } catch (error) {
      console.error(
        error
      );

      setConfirmOpen(false);

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "No se pudo guardar el flete."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
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

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      {/* =======================================================
          HEADER
      ======================================================== */}

      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-6 py-5">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="mt-1 text-3xl leading-none text-slate-500 transition hover:-translate-x-1 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title="Volver"
            >
              ←
            </button>

            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Relación de Fletes
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Nuevo flete
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Captura la información
                del nuevo servicio.
              </p>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* =======================================================
          CONTENIDO
      ======================================================== */}

      <section className="mx-auto max-w-7xl px-6 py-7">
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={
            requestSave
          }
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {/* ===================================================
              INFORMACIÓN
          ==================================================== */}

          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h2 className="text-lg font-bold">
              Información del servicio
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Selecciona las opciones
              correspondientes y
              completa los datos del
              servicio.
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            {/* FECHA */}

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

            {/* UNIDAD */}

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

            {/* FACTURA */}

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

            {/* CLIENTE */}

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

            {/* TIPO */}

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

            {/* CATEGORÍA */}

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

            {/* CONTENEDOR */}

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

            {/* PESO */}

            <Field label="Peso">
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

            {/* DESTINO */}

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

            {/* FLETE RODRIGO */}

            <Field label="Flete Rodrigo">
              <input
                type="number"
                step="any"
                min="0"
                value={
                  form.rodrigo_cash_freight
                }
                onChange={(event) =>
                  updateForm(
                    "rodrigo_cash_freight",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            {/* FLETE FACTURA */}

            <Field label="Flete factura">
              <input
                type="number"
                step="any"
                min="0"
                value={
                  form.invoice_freight
                }
                onChange={(event) =>
                  updateForm(
                    "invoice_freight",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            {/* ANTICIPO CARLOS */}

            <Field label="Anticipo Carlos">
              <input
                type="number"
                step="any"
                min="0"
                value={
                  form.carlos_cash_advance
                }
                onChange={(event) =>
                  updateForm(
                    "carlos_cash_advance",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            {/* PAGO CARLOS */}

            <Field label="Pago Carlos">
              <input
                type="number"
                step="any"
                min="0"
                value={
                  form.carlos_invoice_payment
                }
                onChange={(event) =>
                  updateForm(
                    "carlos_invoice_payment",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>

            {/* OBSERVACIONES */}

            <div className="md:col-span-2 xl:col-span-3">
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
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>
          </div>

          {/* ===================================================
              CAMPOS PERSONALIZADOS
          ==================================================== */}

          {customFields.length >
            0 && (
            <>
              <div className="border-y border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h2 className="font-bold">
                  Campos personalizados
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Información adicional
                  configurada para los
                  fletes.
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

          {/* ===================================================
              BOTONES
          ==================================================== */}

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-800">
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
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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

      {/* =======================================================
          CONFIRMACIÓN
      ======================================================== */}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              !
            </div>

            <h2 className="text-xl font-bold">
              ¿Guardar este flete?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Se creará un nuevo
              registro y el movimiento
              quedará registrado en
              Auditoría.
            </p>

            <div className="mt-6 flex justify-center gap-3">
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
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
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
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {saving
                  ? "Guardando..."
                  : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          ÉXITO
      ======================================================== */}

      {successFolio && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-2xl dark:border-emerald-900 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              OK
            </div>

            <h3 className="text-xl font-bold">
              Flete creado
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {successFolio} se
              guardó correctamente.
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Movimiento registrado en
              Auditoría.
            </p>

            <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500"
                style={{
                  animation:
                    "toastProgress 3s linear forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const selectClass =
  "w-full cursor-pointer appearance-auto rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

// ============================================================
// FIELD
// ============================================================

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

// ============================================================
// SELECT DE CATÁLOGO
// ============================================================

function CatalogSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: CatalogOption[];
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

// ============================================================
// CAMPO PERSONALIZADO
// ============================================================

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

        <label className="flex h-[46px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 dark:border-slate-700 dark:bg-slate-950">
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
            className="h-5 w-5 accent-emerald-600"
          />

          <span className="text-sm">
            Sí
          </span>
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