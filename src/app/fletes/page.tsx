"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

type Role =
  | "reader"
  | "editor"
  | "superuser";

type Profile = {
  role: Role;
  active: boolean;
};

type MainColumn = {
  id: string;
  column_key: string;
  label: string;
  visible: boolean;
  sort_order: number;
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

export default function FletesPage() {
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
    services,
    setServices,
  ] =
    useState<FreightService[]>(
      []
    );

  const [
    mainColumns,
    setMainColumns,
  ] =
    useState<MainColumn[]>(
      []
    );

  const [
    customFields,
    setCustomFields,
  ] =
    useState<CustomField[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

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
            "role, active"
          )
          .eq(
            "id",
            user.id
          )
          .single();

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

        const [
          mainResult,
          customResult,
          freightResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "freight_column_settings"
              )
              .select(
                `
                id,
                column_key,
                label,
                visible,
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
                "freight_services"
              )
              .select("*")
              .order(
                "service_date",
                {
                  ascending:
                    false,
                }
              )
              .order(
                "folio",
                {
                  ascending:
                    false,
                }
              ),
          ]);

        if (
          mainResult.error
        ) {
          throw mainResult.error;
        }

        if (
          customResult.error
        ) {
          throw customResult.error;
        }

        if (
          freightResult.error
        ) {
          throw freightResult.error;
        }

        if (!mounted) {
          return;
        }

        setProfile(
          profileData as Profile
        );

        setMainColumns(
          (mainResult.data ??
            []) as MainColumn[]
        );

        setCustomFields(
          (customResult.data ??
            []) as CustomField[]
        );

        setServices(
          (freightResult.data ??
            []) as FreightService[]
        );
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los fletes."
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

  const canEdit =
    profile?.role ===
      "editor" ||
    profile?.role ===
      "superuser";

  const canDelete =
    profile?.role ===
    "superuser";

  const isSuperuser =
    profile?.role ===
    "superuser";

  const filteredServices =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return services;
      }

      return services.filter(
        (service) => {
          const values = [
            service.folio,
            service.service_date,
            service.unit,
            service.invoice,
            service.client,
            service.service_type,
            service.container,
            service.weight,
            service.destination,
            service.rodrigo_cash_freight,
            service.invoice_freight,
            service.carlos_cash_advance,
            service.carlos_invoice_payment,
            service.observations,
            ...Object.values(
              service.custom_fields ??
                {}
            ),
          ];

          return values
            .filter(
              (value) =>
                value !== null &&
                value !==
                  undefined
            )
            .join(" ")
            .toLowerCase()
            .includes(term);
        }
      );
    }, [
      search,
      services,
    ]);

  function formatMoney(
    value:
      | number
      | null
      | undefined
  ) {
    return new Intl.NumberFormat(
      "es-MX",
      {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits:
          2,
      }
    ).format(
      value ?? 0
    );
  }

  function formatDate(
    value:
      | string
      | null
  ) {
    if (!value) {
      return "—";
    }

    const [
      year,
      month,
      day,
    ] =
      value.split("-");

    if (
      !year ||
      !month ||
      !day
    ) {
      return value;
    }

    return `${day}/${month}/${year}`;
  }

  function renderMainColumn(
    service: FreightService,
    key: string
  ) {
    switch (key) {
      case "folio":
        return `F-${String(
          service.folio
        ).padStart(
          4,
          "0"
        )}`;

      case "service_date":
        return formatDate(
          service.service_date
        );

      case "unit":
        return (
          service.unit ?? "—"
        );

      case "invoice":
        return (
          service.invoice ??
          "—"
        );

      case "client":
        return (
          service.client ??
          "—"
        );

      case "service_type":
        return (
          service.service_type ??
          "—"
        );

      case "container":
        return (
          service.container ??
          "—"
        );

      case "weight":
        return (
          service.weight ??
          "—"
        );

      case "destination":
        return (
          service.destination ??
          "—"
        );

      case "rodrigo_cash_freight":
        return formatMoney(
          service.rodrigo_cash_freight
        );

      case "invoice_freight":
        return formatMoney(
          service.invoice_freight
        );

      case "carlos_cash_advance":
        return formatMoney(
          service.carlos_cash_advance
        );

      case "carlos_invoice_payment":
        return formatMoney(
          service.carlos_invoice_payment
        );

      case "observations":
        return (
          service.observations ??
          "—"
        );

      default:
        return "—";
    }
  }

  function rawMainValue(
    service: FreightService,
    key: string
  ): unknown {
    switch (key) {
      case "folio":
        return `F-${String(
          service.folio
        ).padStart(
          4,
          "0"
        )}`;

      case "service_date":
        return service.service_date;

      case "unit":
        return service.unit;

      case "invoice":
        return service.invoice;

      case "client":
        return service.client;

      case "service_type":
        return service.service_type;

      case "container":
        return service.container;

      case "weight":
        return service.weight;

      case "destination":
        return service.destination;

      case "rodrigo_cash_freight":
        return service.rodrigo_cash_freight;

      case "invoice_freight":
        return service.invoice_freight;

      case "carlos_cash_advance":
        return service.carlos_cash_advance;

      case "carlos_invoice_payment":
        return service.carlos_invoice_payment;

      case "observations":
        return service.observations;

      default:
        return null;
    }
  }

  function isRightAligned(
    key: string
  ) {
    return [
      "weight",
      "rodrigo_cash_freight",
      "invoice_freight",
      "carlos_cash_advance",
      "carlos_invoice_payment",
    ].includes(key);
  }

  function formatCustomValue(
    value: unknown,
    type:
      CustomField["field_type"]
  ) {
    if (
      value === null ||
      value ===
        undefined ||
      value === ""
    ) {
      return "—";
    }

    if (
      type === "boolean"
    ) {
      return value === true ||
        value === "true"
        ? "Sí"
        : "No";
    }

    if (
      type === "number"
    ) {
      const number =
        Number(value);

      if (
        Number.isNaN(
          number
        )
      ) {
        return String(value);
      }

      return new Intl.NumberFormat(
        "es-MX"
      ).format(number);
    }

    if (
      type === "date"
    ) {
      return formatDate(
        String(value)
      );
    }

    return String(value);
  }

  async function handleDelete(
    service: FreightService
  ) {
    if (
      !canDelete ||
      deletingId
    ) {
      return;
    }

    const folio =
      `F-${String(
        service.folio
      ).padStart(
        4,
        "0"
      )}`;

    const confirmed =
      window.confirm(
        `¿Seguro que deseas eliminar el flete ${folio}?\n\nEsta acción no se puede deshacer y quedará registrada en Auditoría.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        service.id
      );

      setErrorMessage(
        ""
      );

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
          `/api/fletes/${service.id}`,
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se pudo eliminar el flete."
        );
      }

      setServices(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              service.id
          )
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el flete."
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  function exportExcel() {
    const rows =
      filteredServices.map(
        (service) => {
          const row:
            Record<
              string,
              unknown
            > = {};

          mainColumns.forEach(
            (column) => {
              row[column.label] =
                rawMainValue(
                  service,
                  column.column_key
                ) ?? "";
            }
          );

          customFields.forEach(
            (field) => {
              row[field.label] =
                service
                  .custom_fields?.[
                  field.field_key
                ] ?? "";
            }
          );

          return row;
        }
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Fletes"
    );

    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );

    XLSX.writeFile(
      workbook,
      `relacion-fletes-${today}.xlsx`
    );
  }

  const totalColumns =
    mainColumns.length +
    customFields.length +
    (canEdit ? 1 : 0);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-slate-600 dark:text-slate-300">
            Cargando fletes...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1900px] flex-col gap-4 px-7 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="mb-1 text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ← Dashboard
            </button>

            <h1 className="text-2xl font-bold">
              Relación de Fletes
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Rol:{" "}
              {profile?.role}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/fletes/hoja"
                )
              }
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
            >
              Hoja de trabajo
            </button>

            <button
              type="button"
              onClick={
                exportExcel
              }
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              Excel
            </button>

            {isSuperuser && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/fletes/campos"
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Campos
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/admin/usuarios"
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Usuarios
                </button>
              </>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/fletes/nuevo"
                  )
                }
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                + Nuevo flete
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1900px] p-7">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Buscar cliente, factura, contenedor, destino..."
            className="w-full max-w-lg rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {
              filteredServices.length
            }{" "}
            {filteredServices.length ===
            1
              ? "registro"
              : "registros"}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span>
            La hoja de trabajo
            permite cálculos
            personales sin modificar
            los datos oficiales.
          </span>

          <span className="text-xs text-slate-400">
            Excel exporta únicamente
            una copia de consulta.
          </span>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white dark:bg-black">
                <tr>
                  {mainColumns.map(
                    (column) => (
                      <TableHeader
                        key={
                          column.id
                        }
                        align={
                          isRightAligned(
                            column.column_key
                          )
                            ? "right"
                            : "left"
                        }
                      >
                        {
                          column.label
                        }
                      </TableHeader>
                    )
                  )}

                  {customFields.map(
                    (field) => (
                      <TableHeader
                        key={
                          field.id
                        }
                        align={
                          field.field_type ===
                          "number"
                            ? "right"
                            : "left"
                        }
                      >
                        {
                          field.label
                        }
                      </TableHeader>
                    )
                  )}

                  {canEdit && (
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredServices.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(
                        totalColumns,
                        1
                      )}
                      className="px-6 py-20 text-center text-slate-500 dark:text-slate-400"
                    >
                      {search
                        ? "No se encontraron registros con esa búsqueda."
                        : "No hay fletes registrados todavía."}
                    </td>
                  </tr>
                ) : (
                  filteredServices.map(
                    (service) => (
                      <tr
                        key={
                          service.id
                        }
                        className="border-t border-slate-200 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        {mainColumns.map(
                          (column) => (
                            <TableCell
                              key={
                                column.id
                              }
                              align={
                                isRightAligned(
                                  column.column_key
                                )
                                  ? "right"
                                  : "left"
                              }
                              bold={
                                column.column_key ===
                                "folio"
                              }
                            >
                              {renderMainColumn(
                                service,
                                column.column_key
                              )}
                            </TableCell>
                          )
                        )}

                        {customFields.map(
                          (field) => (
                            <TableCell
                              key={
                                field.id
                              }
                              align={
                                field.field_type ===
                                "number"
                                  ? "right"
                                  : "left"
                              }
                            >
                              {formatCustomValue(
                                service
                                  .custom_fields?.[
                                  field
                                    .field_key
                                ],
                                field.field_type
                              )}
                            </TableCell>
                          )
                        )}

                        {canEdit && (
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/fletes/${service.id}`
                                  )
                                }
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Editar
                              </button>

                              {canDelete && (
                                <button
                                  type="button"
                                  disabled={
                                    deletingId ===
                                    service.id
                                  }
                                  onClick={() =>
                                    void handleDelete(
                                      service
                                    )
                                  }
                                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                  {deletingId ===
                                  service.id
                                    ? "Eliminando..."
                                    : "Eliminar"}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children:
    React.ReactNode;

  align?:
    | "left"
    | "right"
    | "center";
}) {
  const alignment =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <th
      className={`
        whitespace-nowrap
        border-r
        border-slate-700
        px-4
        py-3
        font-semibold
        ${alignment}
      `}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
  bold = false,
}: {
  children:
    React.ReactNode;

  align?:
    | "left"
    | "right"
    | "center";

  bold?: boolean;
}) {
  const alignment =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <td
      className={`
        whitespace-nowrap
        border-r
        border-slate-200
        px-3
        py-3
        text-slate-800
        dark:border-slate-800
        dark:text-slate-200
        ${alignment}
        ${
          bold
            ? "font-semibold"
            : ""
        }
      `}
    >
      {children}
    </td>
  );
}