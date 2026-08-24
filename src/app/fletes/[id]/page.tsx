"use client";

import {
  FormEvent,
  use,
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

type FreightService = {
  id: string;
  folio: number;
  service_date: string;
  unit: string | null;
  invoice: string | null;
  client: string | null;
  service_type: string | null;
  container: string | null;
  weight: number | null;
  destination: string | null;
  rodrigo_cash_freight:
    | number
    | null;
  invoice_freight:
    | number
    | null;
  carlos_cash_advance:
    | number
    | null;
  carlos_invoice_payment:
    | number
    | null;
  observations: string | null;
  custom_fields:
    | Record<
        string,
        unknown
      >
    | null;
};

type FormState = {
  service_date: string;
  unit: string;
  invoice: string;
  client: string;
  service_type: string;
  container: string;
  weight: string;
  destination: string;
  rodrigo_cash_freight: string;
  invoice_freight: string;
  carlos_cash_advance: string;
  carlos_invoice_payment: string;
  observations: string;
};

function optionalNumber(
  value: string
) {
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

export default function EditarFletePage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = use(params);

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
    form,
    setForm,
  ] =
    useState<FormState>({
      service_date: "",
      unit: "",
      invoice: "",
      client: "",
      service_type: "",
      container: "",
      weight: "",
      destination: "",
      rodrigo_cash_freight:
        "",
      invoice_freight: "",
      carlos_cash_advance:
        "",
      carlos_invoice_payment:
        "",
      observations: "",
    });

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
    successOpen,
    setSuccessOpen,
  ] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
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
        } = await supabase
          .from("profiles")
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
          freightResult,
          fieldsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "freight_services"
              )
              .select("*")
              .eq("id", id)
              .single(),

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
          fieldsResult.error
        ) {
          throw fieldsResult.error;
        }

        const service =
          freightResult.data as FreightService;

        const fields =
          (fieldsResult.data ??
            []) as CustomField[];

        if (!mounted) {
          return;
        }

        setProfile(
          profileData
        );

        setFreight(
          service
        );

        setCustomFields(
          fields
        );

        setForm({
          service_date:
            service.service_date ??
            "",

          unit:
            service.unit ?? "",

          invoice:
            service.invoice ?? "",

          client:
            service.client ?? "",

          service_type:
            service.service_type ??
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
            service.rodrigo_cash_freight ===
              null ||
            service.rodrigo_cash_freight ===
              undefined
              ? ""
              : String(
                  service.rodrigo_cash_freight
                ),

          invoice_freight:
            service.invoice_freight ===
              null ||
            service.invoice_freight ===
              undefined
              ? ""
              : String(
                  service.invoice_freight
                ),

          carlos_cash_advance:
            service.carlos_cash_advance ===
              null ||
            service.carlos_cash_advance ===
              undefined
              ? ""
              : String(
                  service.carlos_cash_advance
                ),

          carlos_invoice_payment:
            service.carlos_invoice_payment ===
              null ||
            service.carlos_invoice_payment ===
              undefined
              ? ""
              : String(
                  service.carlos_invoice_payment
                ),

          observations:
            service.observations ??
            "",
        });

        const custom:
          Record<
            string,
            string | boolean
          > = {};

        fields.forEach(
          (field) => {
            const raw =
              service
                .custom_fields?.[
                field.field_key
              ];

            if (
              field.field_type ===
              "boolean"
            ) {
              custom[
                field.field_key
              ] =
                raw === true ||
                raw === "true";

              return;
            }

            custom[
              field.field_key
            ] =
              raw === null ||
              raw === undefined
                ? ""
                : String(raw);
          }
        );

        setCustomValues(
          custom
        );
      } catch (error) {
        console.error(error);

        setErrorMessage(
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
  }, [
    id,
    router,
    supabase,
  ]);

  function updateForm(
    key: keyof FormState,
    value: string
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  }

  function validate() {
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
        !field.required ||
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
        String(value).trim() ===
          ""
      ) {
        return `El campo "${field.label}" es obligatorio.`;
      }
    }

    return null;
  }

  function requestSave(
    event: FormEvent
  ) {
    event.preventDefault();

    const validation =
      validate();

    if (validation) {
      setErrorMessage(
        validation
      );

      return;
    }

    setErrorMessage("");
    setConfirmOpen(true);
  }

  async function saveChanges() {
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace(
          "/login"
        );

        return;
      }

      const custom:
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
            custom[
              field.field_key
            ] =
              value === ""
                ? null
                : Number(value);

            return;
          }

          custom[
            field.field_key
          ] = value;
        }
      );

      const response =
        await fetch(
          `/api/fletes/${id}`,
          {
            method: "PATCH",

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
                  custom,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se pudo actualizar el flete."
        );
      }

      setConfirmOpen(false);
      setSuccessOpen(true);

      window.setTimeout(
        () => {
          router.push(
            "/fletes"
          );
        },
        3000
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500 dark:text-slate-400">
          Cargando flete...
        </p>
      </main>
    );
  }

  if (
    !profile ||
    !freight
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-red-600">
            {errorMessage ||
              "No se encontró el flete."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/fletes"
              )
            }
            className="mt-4 rounded-lg border px-4 py-2"
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
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl justify-between gap-4 px-6 py-5">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="mt-1 text-3xl text-slate-500 transition hover:-translate-x-1"
            >
              ←
            </button>

            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {folio}
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Editar flete
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Los cambios quedarán
                registrados en
                Auditoría.
              </p>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-7">
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={requestSave}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            <EditField
              label="Fecha"
              required
            >
              <input
                required
                type="date"
                className={
                  editInputClass
                }
                value={
                  form.service_date
                }
                onChange={(event) =>
                  updateForm(
                    "service_date",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Unidad">
              <input
                className={
                  editInputClass
                }
                value={form.unit}
                onChange={(event) =>
                  updateForm(
                    "unit",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Factura">
              <input
                className={
                  editInputClass
                }
                value={
                  form.invoice
                }
                onChange={(event) =>
                  updateForm(
                    "invoice",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Cliente">
              <input
                className={
                  editInputClass
                }
                value={
                  form.client
                }
                onChange={(event) =>
                  updateForm(
                    "client",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Tipo">
              <input
                className={
                  editInputClass
                }
                value={
                  form.service_type
                }
                onChange={(event) =>
                  updateForm(
                    "service_type",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Contenedor">
              <input
                className={
                  editInputClass
                }
                value={
                  form.container
                }
                onChange={(event) =>
                  updateForm(
                    "container",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Peso">
              <input
                type="number"
                step="any"
                className={
                  editInputClass
                }
                value={
                  form.weight
                }
                onChange={(event) =>
                  updateForm(
                    "weight",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Destino">
              <input
                className={
                  editInputClass
                }
                value={
                  form.destination
                }
                onChange={(event) =>
                  updateForm(
                    "destination",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Flete Rodrigo">
              <input
                type="number"
                step="any"
                className={
                  editInputClass
                }
                value={
                  form.rodrigo_cash_freight
                }
                onChange={(event) =>
                  updateForm(
                    "rodrigo_cash_freight",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Flete factura">
              <input
                type="number"
                step="any"
                className={
                  editInputClass
                }
                value={
                  form.invoice_freight
                }
                onChange={(event) =>
                  updateForm(
                    "invoice_freight",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Anticipo Carlos">
              <input
                type="number"
                step="any"
                className={
                  editInputClass
                }
                value={
                  form.carlos_cash_advance
                }
                onChange={(event) =>
                  updateForm(
                    "carlos_cash_advance",
                    event.target.value
                  )
                }
              />
            </EditField>

            <EditField label="Pago Carlos">
              <input
                type="number"
                step="any"
                className={
                  editInputClass
                }
                value={
                  form.carlos_invoice_payment
                }
                onChange={(event) =>
                  updateForm(
                    "carlos_invoice_payment",
                    event.target.value
                  )
                }
              />
            </EditField>

            <div className="md:col-span-2 xl:col-span-3">
              <EditField label="Observaciones">
                <textarea
                  rows={4}
                  className={
                    editInputClass
                  }
                  value={
                    form.observations
                  }
                  onChange={(event) =>
                    updateForm(
                      "observations",
                      event.target.value
                    )
                  }
                />
              </EditField>
            </div>
          </div>

          {customFields.length >
            0 && (
            <>
              <div className="border-y border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h2 className="font-bold">
                  Campos personalizados
                </h2>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
                {customFields.map(
                  (field) => (
                    <EditCustomField
                      key={field.id}
                      field={field}
                      value={
                        customValues[
                          field.field_key
                        ]
                      }
                      onChange={(value) =>
                        setCustomValues(
                          (previous) => ({
                            ...previous,
                            [field.field_key]:
                              value,
                          })
                        )
                      }
                    />
                  )
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium dark:border-slate-700"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              !
            </div>

            <h2 className="text-xl font-bold">
              ¿Guardar estos cambios?
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Se modificará {folio} y
              quedará un registro del
              estado anterior y nuevo.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setConfirmOpen(
                    false
                  )
                }
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm dark:border-slate-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void saveChanges()
                }
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {saving
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {successOpen && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-2xl dark:border-emerald-900 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>

            <h3 className="text-xl font-bold">
              Cambios guardados
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {folio} se actualizó
              correctamente.
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

const editInputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function EditField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
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

function EditCustomField({
  field,
  value,
  onChange,
}: {
  field: CustomField;

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
        </span>

        <label className="flex h-[46px] items-center gap-3 rounded-xl border border-slate-300 px-4 dark:border-slate-700">
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

          Sí
        </label>
      </div>
    );
  }

  return (
    <EditField
      label={field.label}
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
          editInputClass
        }
      />
    </EditField>
  );
}