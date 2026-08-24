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

type FreightService = {
  id: string;
  folio: number;

  service_date:
    string;

  unit:
    string | null;

  invoice:
    string | null;

  client:
    string | null;

  service_type:
    string | null;

  category:
    string | null;

  container:
    string | null;

  weight:
    number | null;

  destination:
    string | null;

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
      rodrigo_cash_freight: "",
      invoice_freight: "",
      carlos_cash_advance: "",
      carlos_invoice_payment: "",
      observations: "",
    });

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login"
          );

          return;
        }

        const {
          data:
            profileData,
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

        const {
          data:
            freightData,

          error:
            freightError,
        } =
          await supabase
            .from(
              "freight_services"
            )
            .select("*")
            .eq(
              "id",
              id
            )
            .single();

        if (
          freightError ||
          !freightData
        ) {
          throw new Error(
            "No se encontró el flete."
          );
        }

        if (!mounted) {
          return;
        }

        const service =
          freightData as FreightService;

        setProfile(
          profileData
        );

        setFreight(
          service
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
              null
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
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
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
      setSaving(true);

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
            "No se pudo actualizar el flete."
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
        3000
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
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Cargando...
      </main>
    );
  }

  if (
    !profile ||
    !freight
  ) {
    return null;
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
        <div className="mx-auto flex max-w-7xl justify-between p-6">
          <div className="flex gap-4">
            <button
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="text-3xl text-slate-500"
            >
              ←
            </button>

            <div>
              <p className="text-blue-600">
                {folio}
              </p>

              <h1 className="text-3xl font-bold">
                Editar flete
              </h1>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-6">
        {errorMessage && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={
            requestSave
          }
          className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                [
                  "service_date",
                  "Fecha",
                ],

                [
                  "unit",
                  "Unidad",
                ],

                [
                  "invoice",
                  "Factura",
                ],

                [
                  "client",
                  "Cliente",
                ],

                [
                  "service_type",
                  "Tipo",
                ],

                [
                  "category",
                  "Categoría",
                ],

                [
                  "container",
                  "Contenedor",
                ],

                [
                  "weight",
                  "Peso",
                ],

                [
                  "destination",
                  "Destino",
                ],

                [
                  "rodrigo_cash_freight",
                  "Flete Rodrigo",
                ],

                [
                  "invoice_freight",
                  "Flete factura",
                ],

                [
                  "carlos_cash_advance",
                  "Anticipo Carlos",
                ],

                [
                  "carlos_invoice_payment",
                  "Pago Carlos",
                ],
              ] as const
            ).map(
              ([
                key,
                label,
              ]) => (
                <Field
                  key={key}
                  label={
                    label
                  }
                >
                  <input
                    type={
                      key ===
                      "service_date"
                        ? "date"
                        : [
                              "weight",
                              "rodrigo_cash_freight",
                              "invoice_freight",
                              "carlos_cash_advance",
                              "carlos_invoice_payment",
                            ].includes(
                              key
                            )
                          ? "number"
                          : "text"
                    }
                    step="any"
                    value={
                      form[
                        key
                      ]
                    }
                    onChange={(e) =>
                      updateForm(
                        key,
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>
              )
            )}

            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Observaciones">
                <textarea
                  rows={4}
                  value={
                    form.observations
                  }
                  onChange={(e) =>
                    updateForm(
                      "observations",
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t p-6 dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes"
                )
              }
              className="rounded-xl border px-5 py-3"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-6 py-3 text-white dark:bg-white dark:text-slate-900"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-7 text-center dark:bg-slate-900">
            <h2 className="text-xl font-bold">
              ¿Guardar cambios?
            </h2>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() =>
                  setConfirmOpen(
                    false
                  )
                }
                className="rounded-xl border px-5 py-3"
              >
                Cancelar
              </button>

              <button
                onClick={() =>
                  void saveChanges()
                }
                disabled={
                  saving
                }
                className="rounded-xl bg-slate-900 px-5 py-3 text-white dark:bg-white dark:text-slate-900"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
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
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

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
      <span className="mb-2 block text-sm font-medium">
        {label}
      </span>

      {children}
    </label>
  );
}