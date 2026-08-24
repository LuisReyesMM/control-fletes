"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

type Role = "reader" | "editor" | "superuser";

type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

type CurrentProfile = {
  id: string;
  full_name: string | null;
  role: Role;
  active: boolean;
};

type Toast = {
  type: "success" | "error";
  message: string;
} | null;

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Nunca";
  }

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function roleName(role: Role) {
  if (role === "superuser") {
    return "Superusuario";
  }

  if (role === "editor") {
    return "Editor";
  }

  return "Lectura";
}

export default function UsuariosPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<CurrentProfile | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<ManagedUser[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [creating, setCreating] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast>(null);

  const [newName, setNewName] = useState("");

  const [newEmail, setNewEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [newRole, setNewRole] = useState<Role>("reader");

  function notify(type: "success" | "error", message: string) {
    setToast({
      type,
      message,
    });

    window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },

      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ?? "No se pudieron cargar los usuarios."
      );
    }

    setUsers(data.users ?? []);
  }, [getToken, router]);

  const initialize = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role, active")
          .eq("id", user.id)
          .single<CurrentProfile>();

      if (profileError || !profileData) {
        throw new Error("No se pudo consultar tu perfil.");
      }

      if (
        profileData.role !== "superuser" ||
        !profileData.active
      ) {
        router.replace("/dashboard");
        return;
      }

      setProfile(profileData);

      await loadUsers();
    } catch (error) {
      console.error(error);

      notify(
        "error",
        error instanceof Error ? error.message : "Ocurrió un error."
      );
    } finally {
      setLoading(false);
    }
  }, [loadUsers, router, supabase]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.email.toLowerCase().includes(term) ||
        user.full_name.toLowerCase().includes(term) ||
        roleName(user.role).toLowerCase().includes(term)
      );
    });
  }, [search, users]);

  function updateLocalUser(
    id: string,
    changes: Partial<ManagedUser>
  ) {
    setUsers((previous) =>
      previous.map((user) =>
        user.id === id
          ? {
              ...user,
              ...changes,
            }
          : user
      )
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating) {
      return;
    }

    try {
      setCreating(true);

      const token = await getToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          full_name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "No se pudo crear el usuario."
        );
      }

      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("reader");

      setShowCreateModal(false);

      await loadUsers();

      notify("success", "Usuario creado correctamente.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudo crear el usuario."
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveUser(user: ManagedUser) {
    if (savingId) {
      return;
    }

    try {
      setSavingId(user.id);

      const token = await getToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        `/api/admin/users/${user.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            full_name: user.full_name,
            role: user.role,
            active: user.active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "No se pudieron guardar los cambios."
        );
      }

      await loadUsers();

      notify("success", "Cambios guardados correctamente.");
    } catch (error) {
      await loadUsers();

      notify(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los cambios."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(user: ManagedUser) {
    if (user.id === currentUserId) {
      notify("error", "No puedes eliminar tu propia cuenta.");
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas eliminar el acceso de ${user.email}?\n\nEsta acción eliminará el usuario de Supabase Auth.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(user.id);

      const token = await getToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        `/api/admin/users/${user.id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "No se pudo eliminar el usuario."
        );
      }

      setUsers((previous) =>
        previous.filter((item) => item.id !== user.id)
      );

      notify("success", "Usuario eliminado correctamente.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el usuario."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargando administración...
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
      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              title="Volver al dashboard"
              className="mt-1 text-3xl leading-none text-slate-500 transition hover:-translate-x-1 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ←
            </button>

            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Administración
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                Gestión de usuarios
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Administra accesos, permisos y roles del sistema.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Rol: <strong>superuser</strong>
            </div>

            <ThemeToggle />

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              + Nuevo usuario
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}

      <section className="mx-auto max-w-[1600px] px-6 py-7">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o rol..."
            className="w-full max-w-xl rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
          />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filteredUsers.length}{" "}
            {filteredUsers.length === 1 ? "usuario" : "usuarios"}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-left text-sm text-white dark:bg-slate-800">
                  <th className="px-4 py-4">
                    Usuario
                  </th>

                  <th className="px-4 py-4">
                    Rol
                  </th>

                  <th className="px-4 py-4">
                    Estado
                  </th>

                  <th className="px-4 py-4">
                    Último acceso
                  </th>

                  <th className="px-4 py-4">
                    Creado
                  </th>

                  <th className="px-4 py-4 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;

                  return (
                    <tr
                      key={user.id}
                      className="border-t border-slate-200 align-top dark:border-slate-800"
                    >
                      <td className="px-4 py-4">
                        <div className="min-w-[250px]">
                          <input
                            value={user.full_name}
                            onChange={(event) =>
                              updateLocalUser(user.id, {
                                full_name: event.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                          />

                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {user.email}
                          </p>

                          {isSelf && (
                            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              Tu cuenta
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <select
                          value={user.role}
                          disabled={isSelf}
                          onChange={(event) =>
                            updateLocalUser(user.id, {
                              role: event.target.value as Role,
                            })
                          }
                          className="min-w-[155px] rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="reader">
                            Lectura
                          </option>

                          <option value="editor">
                            Editor
                          </option>

                          <option value="superuser">
                            Superusuario
                          </option>
                        </select>
                      </td>

                      <td className="px-4 py-4">
                        <label className="inline-flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={user.active}
                            disabled={isSelf}
                            onChange={(event) =>
                              updateLocalUser(user.id, {
                                active: event.target.checked,
                              })
                            }
                            className="h-5 w-5 accent-emerald-600"
                          />

                          <span
                            className={
                              user.active
                                ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                                : "text-sm font-medium text-slate-400"
                            }
                          >
                            {user.active ? "Activo" : "Inactivo"}
                          </span>
                        </label>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(user.last_sign_in_at)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={savingId === user.id}
                            onClick={() => void saveUser(user)}
                            className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                          >
                            {savingId === user.id
                              ? "Guardando..."
                              : "Guardar"}
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              disabled={deletingId === user.id}
                              onClick={() => void deleteUser(user)}
                              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              {deletingId === user.id
                                ? "Eliminando..."
                                : "Eliminar"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-14 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No se encontraron usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL NUEVO USUARIO */}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold">
                  Nuevo usuario
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Crea un nuevo acceso para Control de Fletes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-2xl text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={createUser}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Nombre completo
                </label>

                <input
                  required
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Correo electrónico
                </label>

                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Contraseña temporal
                </label>

                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Rol
                </label>

                <select
                  value={newRole}
                  onChange={(event) =>
                    setNewRole(event.target.value as Role)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="reader">
                    Lectura
                  </option>

                  <option value="editor">
                    Editor
                  </option>

                  <option value="superuser">
                    Superusuario
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  {creating ? "Creando..." : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST */}

      {toast && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-2xl border bg-white p-6 text-center shadow-2xl dark:bg-slate-900 ${
              toast.type === "success"
                ? "border-emerald-200 dark:border-emerald-900"
                : "border-red-200 dark:border-red-900"
            }`}
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {toast.type === "success" ? "✓" : "!"}
            </div>

            <h3 className="text-lg font-bold">
              {toast.type === "success"
                ? "Operación realizada"
                : "No se pudo completar"}
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {toast.message}
            </p>

            <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-100 dark:bg-slate-800">
              <div
                className={
                  toast.type === "success"
                    ? "h-full bg-emerald-500"
                    : "h-full bg-red-500"
                }
                style={{
                  animation: "toastProgress 3.5s linear forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}