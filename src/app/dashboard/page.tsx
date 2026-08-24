"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  role: "reader" | "editor" | "superuser";
  active: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role, active")
        .eq("id", user.id)
        .single();

      if (error || !data || !data.active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    loadUser();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Control de Fletes
            </h1>

            <p className="text-sm text-slate-500">
              Rol: {profile?.role}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Bienvenido
          </p>

          <h2 className="mt-1 text-3xl font-bold text-slate-900">
            {profile?.full_name || "Administrador"}
          </h2>

          <p className="mt-4 text-slate-600">
            El inicio de sesión y los permisos están funcionando.
          </p>

          <button
            onClick={() => router.push("/fletes")}
            className="mt-6 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
            Ver relación de fletes
        </button>

          {profile?.role === "superuser" && (
            <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-800">
              Tienes acceso de superusuario.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}