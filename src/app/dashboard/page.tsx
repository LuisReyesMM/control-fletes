"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function DashboardPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, full_name, role, active")
            .eq("id", user.id)
            .single<Profile>();

        if (profileError || !profileData) {
          console.error("Error cargando perfil:", profileError);

          await supabase.auth.signOut();

          router.replace("/login");
          return;
        }

        if (!profileData.active) {
          await supabase.auth.signOut();

          router.replace("/login");
          return;
        }

        if (!mounted) {
          return;
        }

        setProfile(profileData);

        setEmail(user.email ?? "");
      } catch (error) {
        console.error("Error dashboard:", error);

        router.replace("/login");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await supabase.auth.signOut();

      router.replace("/login");

      router.refresh();
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    } finally {
      setLoggingOut(false);
    }
  }

  function roleLabel(role: Role) {
    switch (role) {
      case "superuser":
        return "Superusuario";

      case "editor":
        return "Editor";

      default:
        return "Lectura";
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cargando...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  const canEdit =
    profile.role === "editor" || profile.role === "superuser";

  const isSuperuser = profile.role === "superuser";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Control de Fletes
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Bienvenido
              {profile.full_name ? `, ${profile.full_name}` : ""}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Rol:{" "}
              <strong className="font-semibold">
                {roleLabel(profile.role)}
              </strong>
            </div>

            <ThemeToggle />

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {loggingOut ? "Saliendo..." : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}

      <section className="mx-auto max-w-[1500px] px-6 py-8 sm:px-8">
        {/* INFORMACIÓN DEL USUARIO */}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Usuario
            </p>

            <p className="mt-2 font-semibold">
              {profile.full_name || "Sin nombre"}
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {email}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nivel de acceso
            </p>

            <p className="mt-2 text-lg font-bold">
              {roleLabel(profile.role)}
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {profile.role === "reader"
                ? "Consulta de información."
                : profile.role === "editor"
                  ? "Consulta, alta y edición de fletes."
                  : "Administración completa del sistema."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Estado
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                Cuenta activa
              </p>
            </div>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sesión autorizada.
            </p>
          </div>
        </div>

        {/* MÓDULOS */}

        <div>
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Módulos
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Accede a las herramientas disponibles para tu cuenta.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {/* FLETES */}

            <button
              type="button"
              onClick={() => router.push("/fletes")}
              className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Operación
                  </p>

                  <h3 className="mt-1 text-xl font-bold">
                    Relación de Fletes
                  </h3>
                </div>

                <span className="text-2xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600">
                  →
                </span>
              </div>

              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Consulta la relación de fletes, realiza búsquedas y trabaja
                con los registros autorizados.
              </p>

              {canEdit && (
                <p className="mt-4 text-xs font-medium text-slate-400">
                  Tu cuenta tiene permisos de edición.
                </p>
              )}
            </button>

            {/* ADMINISTRACIÓN DE USUARIOS */}

            {isSuperuser && (
              <button
                type="button"
                onClick={() => router.push("/admin/usuarios")}
                className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Administración
                    </p>

                    <h3 className="mt-1 text-xl font-bold">
                      Gestión de usuarios
                    </h3>
                  </div>

                  <span className="text-2xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600">
                    →
                  </span>
                </div>

                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Crea usuarios, cambia permisos, administra roles y controla
                  el acceso al sistema.
                </p>
              </button>
            )}

            {/* AUDITORÍA - PREPARADO */}

            {isSuperuser && (
  <button
    type="button"
    onClick={() =>
      router.push("/admin/auditoria")
    }
    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
  >
    <div className="mb-5 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Administración
        </p>

        <h3 className="mt-1 text-xl font-bold">
          Auditoría
        </h3>
      </div>

      <span className="text-2xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600">
        →
      </span>
    </div>

    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
      Consulta el historial de movimientos realizados dentro del sistema.
    </p>
  </button>
)}
          
          </div>
        </div>
      </section>
    </main>
  );
}