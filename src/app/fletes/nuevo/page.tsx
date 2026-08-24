"use client";

import {
  FormEvent,
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

type ToastState = {
  folio: string;
} | null;

const initialForm: FormState = {
  service_date:
    new Date().toISOString().slice(0, 10),

  unit: "",
  invoice: "",
  client: "",
  service_type: "",
  container: "",
  weight: "",
  destination: "",
  rodrigo_cash_freight: "",
  invoice_freight: "",
  carlos_cash_advance: "",
  carlos_invoice_payment: "",
  observations: "",
};

function optionalNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export default function NuevoFletePage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [form, setForm] =
    useState<FormState>(initialForm);

  const [
    customFields,
    setCustomFields,
  ] = useState<CustomField[]>([]);

  const [
    customValues,
    setCustomValues,
  ] = useState<
    Record<string, string | boolean>
  >({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    confirmOpen,
    setConfirmOpen,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [toast, setToast] =
    useState<ToastState>(null);

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
          router.replace("/login");
          return;
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id, role, active"
          )
          .eq("id", user.id)
          .single<Profile>();

        if (
          profileError ||
          !profileData ||
          !profileData.active
        ) {
          await supabase.auth.signOut();

          router.replace("/login");
          return;
        }

        if (
          profileData.role !==
            "editor" &&
          profileData.role !==
            "superuser"
        ) {
          router.replace("/fletes");
          return;
        }

        const {
          data: customData,
          error: customError,
        } = await supabase
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
          .eq("visible", true)
          .order("sort_order", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          });

        if (customError) {
          throw customError;
        }

        if (!mounted) {
          return;
        }

        setProfile(profileData);

        const fields =
          (customData ??
            []) as CustomField[];

        setCustomFields(fields);

        const initialCustom:
          Record<
            string,
            string | boolean
          > = {};

        fields.forEach((field) => {
          initialCustom[
            field.field_key
          ] =
            field.field_type ===
            "boolean"
              ? false
              : "";
        });

        setCustomValues(
          initialCustom
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
  }, [router, supabase]);

  function updateForm(
    field: keyof FormState,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateCustom(
    key: string,
    value:
      | string
      | boolean
  ) {
    setCustomValues(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  }

  function validateForm() {
    if (
      !form.service_date.trim()
    ) {
      return "La fecha del servicio es obligatoria.";
    }

    for (const field of customFields) {
      if (!field.required) {
        continue;
      }

      const value =
        customValues[
          field.field_key
        ];

      if (
        field.field_type !==
          "boolean" &&
        (
          value ===
            undefined ||
          value ===
            null ||
          String(value).trim() ===
            ""
        )
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
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const normalizedCustom:
        Record<string, unknown> = {};

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
                : Number(value);

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
            method: "POST",

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
                  normalizedCustom,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se pudo crear el flete."
        );
      }

      setConfirmOpen(false);

      setToast({
        folio:
          data.folio ??
          "Flete creado",
      });

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
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

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
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
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
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h2 className="text-lg font-bold">
              Información del servicio
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Los datos oficiales se
              guardarán en Supabase.
            </p>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Fecha"
              required
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
                required
                className={inputClass}
              />
            </Field>

            <Field label="Unidad">
              <input
                value={form.unit}
                onChange={(event) =>
                  updateForm(
                    "unit",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Factura">
              <input
                value={
                  form.invoice
                }
                onChange={(event) =>
                  updateForm(
                    "invoice",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Cliente">
              <input
                value={
                  form.client
                }
                onChange={(event) =>
                  updateForm(
                    "client",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Tipo">
              <input
                value={
                  form.service_type
                }
                onChange={(event) =>
                  updateForm(
                    "service_type",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Contenedor">
              <input
                value={
                  form.container
                }
                onChange={(event) =>
                  updateForm(
                    "container",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

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
                className={inputClass}
              />
            </Field>

            <Field label="Destino">
              <input
                value={
                  form.destination
                }
                onChange={(event) =>
                  updateForm(
                    "destination",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Flete Rodrigo">
              <input
                type="number"
                step="any"
                value={
                  form.rodrigo_cash_freight
                }
                onChange={(event) =>
                  updateForm(
                    "rodrigo_cash_freight",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Flete factura">
              <input
                type="number"
                step="any"
                value={
                  form.invoice_freight
                }
                onChange={(event) =>
                  updateForm(
                    "invoice_freight",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Anticipo Carlos">
              <input
                type="number"
                step="any"
                value={
                  form.carlos_cash_advance
                }
                onChange={(event) =>
                  updateForm(
                    "carlos_cash_advance",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            <Field label="Pago Carlos">
              <input
                type="number"
                step="any"
                value={
                  form.carlos_invoice_payment
                }
                onChange={(event) =>
                  updateForm(
                    "carlos_invoice_payment",
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

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
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {customFields.length > 0 && (
            <>
              <div className="border-y border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h2 className="font-bold">
                  Campos personalizados
                </h2>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
                {customFields.map(
                  (field) => (
                    <CustomFieldInput
                      key={field.id}
                      field={field}
                      value={
                        customValues[
                          field.field_key
                        ]
                      }
                      onChange={(value) =>
                        updateCustom(
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

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Guardar flete
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
              ¿Guardar este flete?
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Se creará un nuevo
              registro oficial y el
              movimiento quedará
              registrado en Auditoría.
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
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium dark:border-slate-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
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

      {toast && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-2xl dark:border-emerald-900 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>

            <h3 className="text-xl font-bold">
              Flete creado
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {toast.folio} se guardó
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

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Field({
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

function CustomFieldInput({
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

          {field.required && (
            <span className="ml-1 text-red-500">
              *
            </span>
          )}
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

          <span className="text-sm">
            Sí
          </span>
        </label>
      </div>
    );
  }

  return (
    <Field
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
        value={
          typeof value ===
          "string"
            ? value
            : ""
        }
        required={
          field.required
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className={inputClass}
      />
    </Field>
  );
}