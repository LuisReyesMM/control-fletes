"use client";

import {
  FormEvent,
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

        if (!mounted) {
          return;
        }

       const service: FreightService =
  freightResult.data as FreightService;

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

  function requestSave(
    event:
      FormEvent
  ) {
    event.preventDefault();

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
        // Si el servidor devuelve HTML
        // u otro contenido inesperado.
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
            <Field label="Fecha">
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

            <CatalogField
              label="Unidad"
              value={
                form.unit
              }
              options={getCatalogOptions(
                "UNIT",
                form.unit
              )}
              placeholder="Seleccionar unidad"
              onChange={(value) =>
                updateForm(
                  "unit",
                  value
                )
              }
            />

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

            <CatalogField
              label="Cliente"
              value={
                form.client
              }
              options={getCatalogOptions(
                "CLIENT",
                form.client
              )}
              placeholder="Seleccionar cliente"
              onChange={(value) =>
                updateForm(
                  "client",
                  value
                )
              }
            />

            <CatalogField
              label="Tipo"
              value={
                form.service_type
              }
              options={getCatalogOptions(
                "SERVICE_TYPE",
                form.service_type
              )}
              placeholder="Seleccionar tipo"
              onChange={(value) =>
                updateForm(
                  "service_type",
                  value
                )
              }
            />

            <CatalogField
              label="Categoría"
              value={
                form.category
              }
              options={getCatalogOptions(
                "CATEGORY",
                form.category
              )}
              placeholder="Seleccionar categoría"
              onChange={(value) =>
                updateForm(
                  "category",
                  value
                )
              }
            />

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

            <CatalogField
              label="Destino"
              value={
                form.destination
              }
              options={getCatalogOptions(
                "DESTINATION",
                form.destination
              )}
              placeholder="Seleccionar destino"
              onChange={(value) =>
                updateForm(
                  "destination",
                  value
                )
              }
            />

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
                className={
                  inputClass
                }
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
                className={
                  inputClass
                }
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
                className={
                  inputClass
                }
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
                className={
                  inputClass
                }
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
                  className={`${inputClass} min-h-28 resize-y`}
                />
              </Field>
            </div>
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
    React.ReactNode;
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