"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

type Role = "reader" | "editor" | "superuser";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  active: boolean;
};

type AuditRow = {
  id: string;

  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;

  action: string;
  entity: string;
  entity_id: string | null;
  entity_label: string | null;

  old_data: unknown;
  new_data: unknown;
  metadata: unknown;

  ip_address: string | null;
  user_agent: string | null;

  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    USER_CREATED: "Usuario creado",
    USER_UPDATED: "Usuario actualizado",
    USER_ROLE_CHANGED: "Cambio de rol",
    USER_DISABLED: "Usuario desactivado",
    USER_ENABLED: "Usuario activado",
    USER_DELETED: "Usuario eliminado",

    FREIGHT_CREATED: "Flete creado",
    FREIGHT_UPDATED: "Flete actualizado",
    FREIGHT_DELETED: "Flete eliminado",

    CREATE: "Creación",
    UPDATE: "Actualización",
    DELETE: "Eliminación",
  };

  return map[action] ?? action;
}

function entityLabel(entity: string) {
  const map: Record<string, string> = {
    users: "Usuarios",
    freight_services: "Fletes",
    freight_custom_fields: "Campos personalizados",
    freight_column_settings: "Columnas",
  };

  return map[entity] ?? entity;
}

function renderJson(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditoriaPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [rows, setRows] =
    useState<AuditRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [action, setAction] =
    useState("");

  const [entity, setEntity] =
    useState("");

  const [actor, setActor] =
    useState("");

  const [from, setFrom] =
    useState("");

  const [to, setTo] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [selected, setSelected] =
    useState<AuditRow | null>(null);

  const pageSize = 25;

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  const getToken = useCallback(
    async () => {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      return session?.access_token ?? null;
    },
    [supabase]
  );

  const loadAudit = useCallback(
    async () => {
      const token =
        await getToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (action) {
        params.set("action", action);
      }

      if (entity) {
        params.set("entity", entity);
      }

      if (actor.trim()) {
        params.set(
          "actor",
          actor.trim()
        );
      }

      if (from) {
        params.set("from", from);
      }

      if (to) {
        params.set("to", to);
      }

      params.set(
        "page",
        String(page)
      );

      params.set(
        "pageSize",
        String(pageSize)
      );

      const response =
        await fetch(
          `/api/admin/audit?${params.toString()}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "No se pudo cargar la auditoría."
        );
      }

      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    },
    [
      action,
      actor,
      entity,
      from,
      getToken,
      page,
      router,
      search,
      to,
    ]
  );

  const initialize =
    useCallback(async () => {
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
        } =
          await supabase
            .from("profiles")
            .select(
              "id, full_name, role, active"
            )
            .eq("id", user.id)
            .single<Profile>();

        if (
          profileError ||
          !profileData
        ) {
          throw new Error(
            "No se pudo consultar tu perfil."
          );
        }

        if (
          profileData.role !==
            "superuser" ||
          !profileData.active
        ) {
          router.replace(
            "/dashboard"
          );
          return;
        }

        setProfile(profileData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, [
      router,
      supabase,
    ]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadAudit().catch((error) => {
        console.error(error);
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [profile, loadAudit]);

  function clearFilters() {
    setSearch("");
    setAction("");
    setEntity("");
    setActor("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargando auditoría...
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
        <div className="mx-auto flex max-w-[1700px] flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() =>
                router.push("/dashboard")
              }
              className="mt-1 text-3xl text-slate-500 transition hover:-translate-x-1 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title="Volver al dashboard"
            >
              ←
            </button>

            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Administración
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Auditoría
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Historial de movimientos realizados dentro del sistema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Rol: <strong>superuser</strong>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1700px] px-6 py-7">
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar..."
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />

          <input
            value={actor}
            onChange={(event) => {
              setActor(event.target.value);
              setPage(1);
            }}
            placeholder="Usuario / correo"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />

          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">
              Todas las acciones
            </option>

            <option value="USER_CREATED">
              Usuario creado
            </option>

            <option value="USER_UPDATED">
              Usuario actualizado
            </option>

            <option value="USER_ROLE_CHANGED">
              Cambio de rol
            </option>

            <option value="USER_DISABLED">
              Usuario desactivado
            </option>

            <option value="USER_ENABLED">
              Usuario activado
            </option>

            <option value="USER_DELETED">
              Usuario eliminado
            </option>

            <option value="FREIGHT_CREATED">
              Flete creado
            </option>

            <option value="FREIGHT_UPDATED">
              Flete actualizado
            </option>

            <option value="FREIGHT_DELETED">
              Flete eliminado
            </option>
          </select>

          <select
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">
              Todos los módulos
            </option>

            <option value="users">
              Usuarios
            </option>

            <option value="freight_services">
              Fletes
            </option>

            <option value="freight_custom_fields">
              Campos personalizados
            </option>

            <option value="freight_column_settings">
              Columnas
            </option>
          </select>

          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <div className="xl:col-span-6 flex justify-between">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Limpiar filtros
            </button>

            <span className="text-sm text-slate-500 dark:text-slate-400">
              {total} movimiento
              {total === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-left text-sm text-white dark:bg-slate-800">
                  <th className="px-4 py-4">
                    Fecha
                  </th>

                  <th className="px-4 py-4">
                    Usuario
                  </th>

                  <th className="px-4 py-4">
                    Acción
                  </th>

                  <th className="px-4 py-4">
                    Módulo
                  </th>

                  <th className="px-4 py-4">
                    Registro
                  </th>

                  <th className="px-4 py-4">
                    IP
                  </th>

                  <th className="px-4 py-4 text-right">
                    Detalle
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-200 dark:border-slate-800"
                  >
                    <td className="px-4 py-4 text-sm">
                      {formatDate(row.created_at)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {row.actor_name || "Sin nombre"}
                      </div>

                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {row.actor_email || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {actionLabel(row.action)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm">
                      {entityLabel(row.entity)}
                    </td>

                    <td className="px-4 py-4 text-sm">
                      {row.entity_label ||
                        row.entity_id ||
                        "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {row.ip_address || "—"}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelected(row)
                        }
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-14 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No hay movimientos que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                setPage((value) =>
                  Math.max(1, value - 1)
                )
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
            >
              Anterior
            </button>

            <span className="text-sm text-slate-500 dark:text-slate-400">
              Página {page} de {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((value) =>
                  Math.min(
                    totalPages,
                    value + 1
                  )
                )
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold">
                  Detalle del movimiento
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {actionLabel(selected.action)}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="text-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Información anterior
                </p>

                <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {renderJson(
                    selected.old_data
                  )}
                </pre>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">
                  Información nueva
                </p>

                <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {renderJson(
                    selected.new_data
                  )}
                </pre>
              </div>

              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-semibold">
                  Información técnica
                </p>

                <div className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                  <p>
                    <strong>Fecha:</strong>{" "}
                    {formatDate(
                      selected.created_at
                    )}
                  </p>

                  <p className="mt-2">
                    <strong>IP:</strong>{" "}
                    {selected.ip_address ||
                      "—"}
                  </p>

                  <p className="mt-2 break-all">
                    <strong>Navegador:</strong>{" "}
                    {selected.user_agent ||
                      "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}