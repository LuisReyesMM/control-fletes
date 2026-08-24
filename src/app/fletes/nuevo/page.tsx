"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
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

type CustomValue = string | number | boolean;

export default function NuevoFletePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // =========================================================
  // ESTADO GENERAL
  // =========================================================

  const [role, setRole] = useState<Role | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  // =========================================================
  // CONFIRMACIÓN
  // =========================================================

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  // =========================================================
  // TOAST DE ÉXITO
  // =========================================================

  const [successMessage, setSuccessMessage] =
    useState("");

  const [showSuccessToast, setShowSuccessToast] =
    useState(false);

  // =========================================================
  // CAMPOS PERSONALIZADOS
  // =========================================================

  const [customFields, setCustomFields] =
    useState<CustomField[]>([]);

  const [customValues, setCustomValues] =
    useState<Record<string, CustomValue>>({});

  // =========================================================
  // CAMPOS PRINCIPALES
  // =========================================================

  const [serviceDate, setServiceDate] = useState("");
  const [unit, setUnit] = useState("");
  const [invoice, setInvoice] = useState("");
  const [client, setClient] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [container, setContainer] = useState("");
  const [weight, setWeight] = useState("");
  const [destination, setDestination] = useState("");

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

  const [observations, setObservations] = useState("");

  // =========================================================
  // TOAST: 3 SEGUNDOS
  // =========================================================

  useEffect(() => {
    if (!showSuccessToast) {
      return;
    }

    const timer = window.setTimeout(() => {
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
  // CARGAR USUARIO Y CAMPOS DINÁMICOS
  // =========================================================

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      // USUARIO

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // PERFIL

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

      // SOLO EDITOR Y SUPERUSER PUEDEN CREAR

      if (
        profile.role !== "editor" &&
        profile.role !== "superuser"
      ) {
        router.replace("/fletes");
        return;
      }

      setRole(profile.role as Role);

      // CAMPOS PERSONALIZADOS VISIBLES

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

      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  // =========================================================
  // ABRIR CONFIRMACIÓN
  // =========================================================

  function requestSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!serviceDate) {
      setErrorMessage(
        "La fecha del servicio es obligatoria."
      );

      return;
    }

    const missingRequiredField =
      customFields.find((field) => {
        if (!field.required) {
          return false;
        }

        const value =
          customValues[field.field_key];

        return (
          value === undefined ||
          value === null ||
          value === ""
        );
      });

    if (missingRequiredField) {
      setErrorMessage(
        `El campo "${missingRequiredField.label}" es obligatorio.`
      );

      return;
    }

    setShowConfirmModal(true);
  }

  // =========================================================
  // GUARDAR NUEVO FLETE
  // =========================================================

  async function handleSave() {
    setSaving(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setShowConfirmModal(false);

      setErrorMessage(
        "No se pudo identificar al usuario."
      );

      setSaving(false);
      return;
    }

    const numericWeight =
      weight === "" ? null : Number(weight);

    if (
      numericWeight !== null &&
      Number.isNaN(numericWeight)
    ) {
      setShowConfirmModal(false);

      setErrorMessage(
        "El peso debe contener un número válido."
      );

      setSaving(false);
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("freight_services")
      .insert({
        service_date: serviceDate,

        unit:
          unit.trim() || null,

        invoice:
          invoice.trim() || null,

        client:
          client.trim() || null,

        service_type:
          serviceType.trim() || null,

        container:
          container.trim() || null,

        weight: numericWeight,

        destination:
          destination.trim() || null,

        rodrigo_cash_freight:
          Number(rodrigoCashFreight || 0),

        invoice_freight:
          Number(invoiceFreight || 0),

        carlos_cash_advance:
          Number(carlosCashAdvance || 0),

        carlos_invoice_payment:
          Number(carlosInvoicePayment || 0),

        observations:
          observations.trim() || null,

        custom_fields:
          customValues,

        created_by:
          user.id,

        updated_by:
          user.id,
      })
      .select("id, folio")
      .single();

    if (error) {
      setShowConfirmModal(false);

      setErrorMessage(
        `No se pudo guardar el flete: ${error.message}`
      );

      setSaving(false);
      return;
    }

    if (!data) {
      setShowConfirmModal(false);

      setErrorMessage(
        "Supabase no confirmó la creación del registro."
      );

      setSaving(false);
      return;
    }

    setShowConfirmModal(false);
    setSaving(false);

    const folio = `F-${String(
      data.folio
    ).padStart(4, "0")}`;

    setSuccessMessage(
      `El flete ${folio} fue registrado correctamente.`
    );

    setShowSuccessToast(true);
  }

  // =========================================================
  // ACTUALIZAR CAMPO PERSONALIZADO
  // =========================================================

  function updateCustomValue(
    field: CustomField,
    rawValue: string
  ) {
    if (rawValue === "") {
      setCustomValues((current) => {
        const next = { ...current };

        delete next[field.field_key];

        return next;
      });

      return;
    }

    let value: CustomValue = rawValue;

    if (field.field_type === "number") {
      value = Number(rawValue);
    }

    if (field.field_type === "boolean") {
      value = rawValue === "true";
    }

    setCustomValues((current) => ({
      ...current,
      [field.field_key]: value,
    }));
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
            Cargando formulario...
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
          MODAL DE CONFIRMACIÓN
      ====================================================== */}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[3px]">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white px-8 py-9 text-center shadow-[0_30px_100px_rgba(0,0,0,0.25)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl font-bold text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              !
            </div>

            <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
              ¿Registrar este flete?
            </h2>

            <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
              Confirma que deseas guardar este nuevo
              registro en el sistema.
            </p>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setShowConfirmModal(false)
                }
                className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded-xl bg-slate-900 px-7 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {saving
                  ? "Guardando..."
                  : "Registrar flete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          TOAST DE ÉXITO
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
                Registro guardado
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

            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              Nuevo flete
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registra la información del servicio.
            </p>

            {role && (
              <p className="mt-1 text-xs text-slate-400">
                Rol: {role}
              </p>
            )}
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* =====================================================
          FORMULARIO
      ====================================================== */}

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <form
          onSubmit={requestSave}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-6 text-xl font-bold">
            Información del servicio
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Fecha *">
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

            <Field label="Unidad">
              <input
                type="text"
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value)
                }
                placeholder="ECO 001"
                className={inputClass}
              />
            </Field>

            <Field label="Factura">
              <input
                type="text"
                value={invoice}
                onChange={(event) =>
                  setInvoice(event.target.value)
                }
                placeholder="N2190"
                className={inputClass}
              />
            </Field>

            <Field label="Cliente">
              <input
                type="text"
                value={client}
                onChange={(event) =>
                  setClient(event.target.value)
                }
                placeholder="NIROMA"
                className={inputClass}
              />
            </Field>

            <Field label="Tipo de servicio">
              <input
                type="text"
                value={serviceType}
                onChange={(event) =>
                  setServiceType(
                    event.target.value
                  )
                }
                placeholder="Foráneo"
                className={inputClass}
              />
            </Field>

            <Field label="Contenedor">
              <input
                type="text"
                value={container}
                onChange={(event) =>
                  setContainer(
                    event.target.value
                  )
                }
                placeholder="FFAU6997931"
                className={inputClass}
              />
            </Field>

            <Field label="Peso">
              <input
                type="number"
                step="0.001"
                value={weight}
                onChange={(event) =>
                  setWeight(event.target.value)
                }
                placeholder="31.720"
                className={inputClass}
              />
            </Field>

            <Field label="Destino">
              <input
                type="text"
                value={destination}
                onChange={(event) =>
                  setDestination(
                    event.target.value
                  )
                }
                placeholder="Zacualtipán"
                className={inputClass}
              />
            </Field>

            <Field label="Flete efectivo Rodrigo">
              <input
                type="number"
                step="0.01"
                value={rodrigoCashFreight}
                onChange={(event) =>
                  setRodrigoCashFreight(
                    event.target.value
                  )
                }
                placeholder="0.00"
                className={inputClass}
              />
            </Field>

            <Field label="Flete factura">
              <input
                type="number"
                step="0.01"
                value={invoiceFreight}
                onChange={(event) =>
                  setInvoiceFreight(
                    event.target.value
                  )
                }
                placeholder="0.00"
                className={inputClass}
              />
            </Field>

            <Field label="Anticipo efectivo Carlos">
              <input
                type="number"
                step="0.01"
                value={carlosCashAdvance}
                onChange={(event) =>
                  setCarlosCashAdvance(
                    event.target.value
                  )
                }
                placeholder="0.00"
                className={inputClass}
              />
            </Field>

            <Field label="Pago factura Carlos">
              <input
                type="number"
                step="0.01"
                value={carlosInvoicePayment}
                onChange={(event) =>
                  setCarlosInvoicePayment(
                    event.target.value
                  )
                }
                placeholder="0.00"
                className={inputClass}
              />
            </Field>
          </div>

          {/* =================================================
              CAMPOS PERSONALIZADOS
          ================================================== */}

          {customFields.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-7 dark:border-slate-700">
              <div className="mb-6">
                <h2 className="text-xl font-bold">
                  Campos adicionales
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Estos campos fueron configurados por el
                  superusuario.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {customFields.map((field) => (
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
                            field.field_key
                          ] ?? ""
                        )}
                        onChange={(event) =>
                          updateCustomValue(
                            field,
                            event.target.value
                          )
                        }
                        className={inputClass}
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
                            field.field_key
                          ] ?? ""
                        )}
                        onChange={(event) =>
                          updateCustomValue(
                            field,
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    )}
                  </Field>
                ))}
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
                placeholder="Comentarios adicionales..."
                className={inputClass}
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
                router.push("/fletes")
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
              Guardar flete
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

// ===========================================================
// CLASE DE INPUTS
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