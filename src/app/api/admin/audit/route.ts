import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Role = "reader" | "editor" | "superuser";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  active: boolean;
};

function cleanFilterValue(value: string) {
  return value
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error("Faltan variables privadas de Supabase.");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function requireSuperuser(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      ),
    };
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: "Token inválido." },
        { status: 401 }
      ),
    };
  }

  const admin = getAdminClient();

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(accessToken);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Sesión inválida o expirada." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single<Profile>();

  if (
    profileError ||
    !profile ||
    profile.role !== "superuser" ||
    !profile.active
  ) {
    return {
      error: NextResponse.json(
        { error: "No tienes permisos para consultar auditoría." },
        { status: 403 }
      ),
    };
  }

  return {
    admin,
    user,
    profile,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperuser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const { admin } = auth;

    const url = new URL(request.url);

    const search = cleanFilterValue(
      url.searchParams.get("search") ?? ""
    );
    const action = cleanFilterValue(
      url.searchParams.get("action") ?? ""
    );
    const entity = cleanFilterValue(
      url.searchParams.get("entity") ?? ""
    );
    const actor = cleanFilterValue(
      url.searchParams.get("actor") ?? ""
    );

    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const page = Math.max(
      1,
      Number(url.searchParams.get("page") ?? "1") || 1
    );

    const pageSize = Math.min(
      100,
      Math.max(
        10,
        Number(url.searchParams.get("pageSize") ?? "25") || 25
      )
    );

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    let query = admin
      .from("audit_log")
      .select(
        `
        id,
        actor_id,
        actor_email,
        actor_name,
        actor_role,
        action,
        entity,
        entity_id,
        entity_label,
        old_data,
        new_data,
        metadata,
        ip_address,
        user_agent,
        created_at
        `,
        {
          count: "exact",
        }
      )
      .order("created_at", {
        ascending: false,
      })
      .range(fromIndex, toIndex);

    if (action) {
      query = query.eq("action", action);
    }

    if (entity) {
      query = query.eq("entity", entity);
    }

    if (actor) {
      query = query.or(
        `actor_email.ilike.%${actor}%,actor_name.ilike.%${actor}%`
      );
    }

    if (from) {
      query = query.gte(
        "created_at",
        new Date(`${from}T00:00:00`).toISOString()
      );
    }

    if (to) {
      query = query.lte(
        "created_at",
        new Date(`${to}T23:59:59.999`).toISOString()
      );
    }

    if (search) {
      query = query.or(
        [
          `actor_email.ilike.%${search}%`,
          `actor_name.ilike.%${search}%`,
          `action.ilike.%${search}%`,
          `entity.ilike.%${search}%`,
          `entity_label.ilike.%${search}%`,
        ].join(",")
      );
    }

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error("Error consultando audit_log:", error);

      return NextResponse.json(
        {
          error: "No se pudo consultar la bitácora.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        rows: data ?? [],
        total: count ?? 0,
        page,
        pageSize,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/admin/audit:", error);

    return NextResponse.json(
      {
        error: "Error interno al consultar auditoría.",
      },
      {
        status: 500,
      }
    );
  }
}