"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

type Role = "reader" | "editor" | "superuser";

type CustomField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean";
  visible: boolean;
  required: boolean;
  sort_order: number;
};

type FreightService = {
  id: string;
  service_date: string;

  unit: string | null;
  invoice: string | null;
  client: string | null;
  service_type: string | null;
  container: string | null;

  weight: number | null;

  destination: string | null;

  rodrigo_cash_freight: number;
  invoice_freight: number;
  carlos_cash_advance: number;
  carlos_invoice_payment: number;

  observations: string | null;

  custom_fields: Record<string, unknown> | null;
};

export default function EditarFletePage() {
  const router = useRouter();
  const params = useParams();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const id = params.id as string;

  // =========================================================
  // ESTADOS GENERALES
  // =========================================================

  const [role, setRole] =
    useState<Role | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // =========================================================
  // TOAST
  // =========================================================

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    showSuccessToast,
    setShowSuccessToast,
  ] = useState(false);

  // =========================================================
  // CAMPOS DINÁMICOS
  // =========================================================

  const [
    customFields,
    setCustomFields,
  ] = useState<CustomField[]>([]);

  const [
    customValues,
    setCustomValues,
  ] = useState<
    Record<
      string,
      string | number | boolean
    >
  >({});

  // =========================================================
  // CAMPOS PRINCIPALES
  // =========================================================

  const [
    serviceDate,
    setServiceDate,
  ] = useState("");

  const [unit, setUnit] =
    useState("");

  const [invoice, setInvoice] =
    useState("");

  const [client, setClient] =
    useState("");

  const [
    serviceType,
    setServiceType,
  ] = useState("");

  const [
    container,
    setContainer,
  ] = useState("");

  const [weight, setWeight] =
    useState("");

  const [
    destination,
    setDestination,
  ] = useState("");

  const [
    rodrigoCashFreight,
    setRodrigoCashFreight,
  ] = useState("");

  const [
    invoiceFreight,
    setInvoiceFreight,
  ] = useState("");

  const [
    carlosCashAdvance,
    setCarlosCashAdvance,
  ] = useState("");

  const [
    carlosInvoicePayment,
    setCarlosInvoicePayment,
  ] = useState("");

  const [
    observations,
    setObservations,
  ] = useState("");

  // =========================================================
  // TOAST: 3 SEGUNDOS Y REGRESO A FLETES
  // =========================================================

  useEffect(() => {
    if (!showSuccessToast) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setShowSuccessToast(false);
        setSuccessMessage("");

        router.push("/fletes");
        router.refresh();
      }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showSuccessToast, router]);

  // =========================================================
  // CARGAR INFORMACIÓN
  // =========================================================

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      // -----------------------------------------------------
      // USUARIO
      // -----------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // -----------------------------------------------------
      // PERFIL
      // -----------------------------------------------------

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        !profile.active
      ) {
        await supabase.auth.signOut();

        router.replace("/login");
        return;
      }

      if (
        profile.role !== "editor" &&
        profile.role !== "superuser"
      ) {
        router.replace("/fletes");
        return;
      }

      setRole(profile.role as Role);

      // -----------------------------------------------------
      // CAMPOS DINÁMICOS VISIBLES
      // -----------------------------------------------------

      const {
        data: fields,
        error: fieldsError,
      } = await supabase
        .from("freight_custom_fields")
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

      if (fieldsError) {
        setErrorMessage(
          `No se pudieron cargar los campos adicionales: ${fieldsError.message}`
        );

        setLoading(false);
        return;
      }

      setCustomFields(
        (fields ?? []) as CustomField[]
      );

      // -----------------------------------------------------
      // CARGAR FLETE
      // -----------------------------------------------------

      const {
        data,
        error,
      } = await supabase
        .from("freight_services")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setErrorMessage(
          error?.message ||
            "No se encontró el registro."
        );

        setLoading(false);
        return;
      }

      const service =
        data as FreightService;

      // -----------------------------------------------------
      // PASAR DATOS A LOS ESTADOS
      // -----------------------------------------------------

      setServiceDate(
        service.service_date ?? ""
      );

      setUnit(
        service.unit ?? ""
      );

      setInvoice(
        service.invoice ?? ""
      );

      setClient(
        service.client ?? ""
      );

      setServiceType(
        service.service_type ?? ""
      );

      setContainer(
        service.container ?? ""
      );

      setWeight(
        service.weight === null ||
          service.weight === undefined
          ? ""
          : String(service.weight)
      );

      setDestination(
        service.destination ?? ""
      );

      setRodrigoCashFreight(
        String(
          service.rodrigo_cash_freight ??
            0
        )
      );

      setInvoiceFreight(
        String(
          service.invoice_freight ??
            0
        )
      );

      setCarlosCashAdvance(
        String(
          service.carlos_cash_advance ??
            0
        )
      );

      setCarlosInvoicePayment(
        String(
          service.carlos_invoice_payment ??
            0
        )
      );

      setObservations(
        service.observations ?? ""
      );

      // -----------------------------------------------------
      // VALORES DINÁMICOS
      // -----------------------------------------------------

      const loadedValues: Record<
        string,
        string | number | boolean
      > = {};

      Object.entries(
        service.custom_fields ?? {}
      ).forEach(
        ([key, value]) => {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            loadedValues[key] =
              value;
          }
        }
      );

      setCustomValues(
        loadedValues
      );

      setLoading(false);
    }

    loadData();
  }, [id, router, supabase]);

  // =========================================================
  // GUARDAR CAMBIOS
  // =========================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);

      router.replace("/login");
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("freight_services")
      .update({
        service_date: serviceDate,

        unit:
          unit.trim() ||
          null,

        invoice:
          invoice.trim() ||
          null,

        client:
          client.trim() ||
          null,

        service_type:
          serviceType.trim() ||
          null,

        container:
          container.trim() ||
          null,

        weight:
          weight === ""
            ? null
            : Number(weight),

        destination:
          destination.trim() ||
          null,

        rodrigo_cash_freight:
          Number(
            rodrigoCashFreight ||
              0
          ),

        invoice_freight:
          Number(
            invoiceFreight ||
              0
          ),

        carlos_cash_advance:
          Number(
            carlosCashAdvance ||
              0
          ),

        carlos_invoice_payment:
          Number(
            carlosInvoicePayment ||
              0
          ),

        observations:
          observations.trim() ||
          null,

        custom_fields:
          customValues,

        updated_by:
          user.id,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      setErrorMessage(
        `No se pudieron guardar los cambios: ${error.message}`
      );

      setSaving(false);
      return;
    }

    if (!data) {
      setErrorMessage(
        "Supabase no confirmó la actualización del registro."
      );

      setSaving(false);
      return;
    }

    setSaving(false);

    setSuccessMessage(
      "El registro se actualizó correctamente."
    );

    setShowSuccessToast(true);
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-slate-600 dark:text-slate-300">
            Cargando flete...
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      {/* =====================================================
          TOAST MODERNO CENTRADO
      ====================================================== */}

      {showSuccessToast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[3px]">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.25)] dark:border-emerald-900 dark:bg-slate-900">
            {/* BARRA DE PROGRESO */}

            <div className="absolute left-0 top-0 h-2 w-full bg-emerald-100 dark:bg-emerald-950">
              <div className="h-full animate-[toastProgress_3s_linear_forwards] bg-emerald-500" />
            </div>

            <div className="flex flex-col items-center px-8 py-12 text-center sm:px-12">
              {/* CHECK */}

              <div className="relative mb-7">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />

                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-5xl font-bold text-white shadow-xl shadow-emerald-500/30">
                  ✓
                </div>
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Cambios guardados
              </h2>

              <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
                {successMessage}
              </p>

              <div className="mt-7 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />

                Regresando a la relación de fletes...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/fletes")
              }
              className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ← Volver a fletes
            </button>

            <h1 className="mt-1 text-2xl font-bold">
              Editar flete
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Rol: {role}
            </p>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* =====================================================
          FORMULARIO
      ====================================================== */}
{showConfirmModal && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[3px]">
    <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white px-8 py-9 text-center shadow-[0_30px_100px_rgba(0,0,0,0.25)] dark:border-slate-700 dark:bg-slate-900">

      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
        !
      </div>

      <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
        ¿Guardar cambios?
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Confirma si deseas guardar las modificaciones realizadas en este registro.
      </p>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setShowConfirmModal(false)}
          className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setShowConfirmModal(false);

            const fakeEvent = {
              preventDefault: () => {},
            } as FormEvent<HTMLFormElement>;

            await handleSubmit(fakeEvent);
          }}
          className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {saving ? "Guardando..." : "Confirmar cambios"}
        </button>
      </div>
    </div>
  </div>
)}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <form
          onSubmit={(event) => {
    event.preventDefault();
    setShowConfirmModal(true);
  }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-6 text-xl font-bold">
            Información del servicio
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* FECHA */}

            <Field label="Fecha">
              <input
                type="date"
                required
                value={serviceDate}
                onChange={(event) =>
                  setServiceDate(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* UNIDAD */}

            <Field label="Unidad">
              <input
                type="text"
                value={unit}
                onChange={(event) =>
                  setUnit(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* FACTURA */}

            <Field label="Factura">
              <input
                type="text"
                value={invoice}
                onChange={(event) =>
                  setInvoice(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* CLIENTE */}

            <Field label="Cliente">
              <input
                type="text"
                value={client}
                onChange={(event) =>
                  setClient(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* TIPO */}

            <Field label="Tipo de servicio">
              <input
                type="text"
                value={serviceType}
                onChange={(event) =>
                  setServiceType(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* CONTENEDOR */}

            <Field label="Contenedor">
              <input
                type="text"
                value={container}
                onChange={(event) =>
                  setContainer(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* PESO */}

            <Field label="Peso">
              <input
                type="number"
                step="0.001"
                value={weight}
                onChange={(event) =>
                  setWeight(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* DESTINO */}

            <Field label="Destino">
              <input
                type="text"
                value={destination}
                onChange={(event) =>
                  setDestination(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* FLETE RODRIGO */}

            <Field label="Flete efectivo Rodrigo">
              <input
                type="number"
                step="0.01"
                value={
                  rodrigoCashFreight
                }
                onChange={(event) =>
                  setRodrigoCashFreight(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* FLETE FACTURA */}

            <Field label="Flete factura">
              <input
                type="number"
                step="0.01"
                value={
                  invoiceFreight
                }
                onChange={(event) =>
                  setInvoiceFreight(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* ANTICIPO CARLOS */}

            <Field label="Anticipo Carlos">
              <input
                type="number"
                step="0.01"
                value={
                  carlosCashAdvance
                }
                onChange={(event) =>
                  setCarlosCashAdvance(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>

            {/* PAGO CARLOS */}

            <Field label="Pago Carlos">
              <input
                type="number"
                step="0.01"
                value={
                  carlosInvoicePayment
                }
                onChange={(event) =>
                  setCarlosInvoicePayment(
                    event.target.value
                  )
                }
                className={inputClass}
              />
            </Field>
          </div>

          {/* =================================================
              CAMPOS DINÁMICOS
          ================================================== */}

          {customFields.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-7 dark:border-slate-700">
              <h2 className="mb-6 text-xl font-bold">
                Campos adicionales
              </h2>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {customFields.map(
                  (field) => (
                    <Field
                      key={field.id}
                      label={
                        field.required
                          ? `${field.label} *`
                          : field.label
                      }
                    >
                      {field.field_type ===
                      "boolean" ? (
                        <select
                          required={
                            field.required
                          }
                          value={String(
                            customValues[
                              field
                                .field_key
                            ] ?? ""
                          )}
                          onChange={(
                            event
                          ) => {
                            const value =
                              event.target
                                .value;

                            setCustomValues(
                              (
                                current
                              ) => ({
                                ...current,

                                [field.field_key]:
                                  value ===
                                  "true",
                              })
                            );
                          }}
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
                      ) : (
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
                          value={String(
                            customValues[
                              field
                                .field_key
                            ] ?? ""
                          )}
                          onChange={(
                            event
                          ) => {
                            const raw =
                              event.target
                                .value;

                            setCustomValues(
                              (
                                current
                              ) => ({
                                ...current,

                                [field.field_key]:
                                  field.field_type ===
                                  "number"
                                    ? raw ===
                                      ""
                                      ? ""
                                      : Number(
                                          raw
                                        )
                                    : raw,
                              })
                            );
                          }}
                          className={
                            inputClass
                          }
                        />
                      )}
                    </Field>
                  )
                )}
              </div>
            </div>
          )}

          {/* =================================================
              OBSERVACIONES
          ================================================== */}

          <div className="mt-7">
            <Field label="Observaciones">
              <textarea
                rows={5}
                value={observations}
                onChange={(event) =>
                  setObservations(
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </Field>
          </div>

          {/* =================================================
              ERROR
          ================================================== */}

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {/* =================================================
              BOTONES
          ================================================== */}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={
                saving ||
                showSuccessToast
              }
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                showSuccessToast
              }
              className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {saving
                ? "Guardando..."
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

// ===========================================================
// ESTILO DE INPUTS
// ===========================================================

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700";

// ===========================================================
// FIELD
// ===========================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      {children}
    </div>
  );
}