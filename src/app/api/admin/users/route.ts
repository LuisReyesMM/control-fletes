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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
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
        {
          error:
            "No tienes permisos para administrar usuarios.",
        },
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

async function writeAuditLog({
  request,
  admin,
  actorId,
  actorEmail,
  actorName,
  actorRole,
  action,
  entityId,
  entityLabel,
  oldData,
  newData,
  metadata,
}: {
  request: NextRequest;
  admin: ReturnType<typeof getAdminClient>;
  actorId: string;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string;
  action: string;
  entityId?: string | null;
  entityLabel?: string | null;
  oldData?: unknown;
  newData?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await admin.from("audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    actor_name: actorName,
    actor_role: actorRole,

    action,
    entity: "users",
    entity_id: entityId ?? null,
    entity_label: entityLabel ?? null,

    old_data: oldData ?? null,
    new_data: newData ?? null,
    metadata: metadata ?? {},

    ip_address: getRequestIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  if (error) {
    console.error("No se pudo escribir audit_log:", error);
  }
}

// ============================================================
// GET /api/admin/users
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperuser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const { admin } = auth;

    const {
      data: authUsersData,
      error: authUsersError,
    } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authUsersError) {
      console.error(authUsersError);

      return NextResponse.json(
        {
          error:
            "No se pudieron consultar los usuarios de Supabase Auth.",
        },
        { status: 500 }
      );
    }

    const { data: profiles, error: profilesError } =
      await admin
        .from("profiles")
        .select("id, full_name, role, active");

    if (profilesError) {
      console.error(profilesError);

      return NextResponse.json(
        {
          error:
            "No se pudieron consultar los perfiles.",
        },
        { status: 500 }
      );
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const users = authUsersData.users.map((user) => {
      const profile = profileMap.get(user.id);

      return {
        id: user.id,
        email: user.email ?? "",
        full_name:
          profile?.full_name ??
          user.user_metadata?.full_name ??
          "",
        role: profile?.role ?? "reader",
        active: profile?.active ?? false,

        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        email_confirmed_at:
          user.email_confirmed_at ?? null,
      };
    });

    users.sort((a, b) =>
      a.email.localeCompare(b.email)
    );

    return NextResponse.json(
      {
        ok: true,
        users,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/admin/users:", error);

    return NextResponse.json(
      {
        error:
          "Error interno al consultar usuarios.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/admin/users
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperuser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const {
      admin,
      user: actor,
      profile: actorProfile,
    } = auth;

    const body = await request.json();

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    const fullName = String(
      body.full_name ?? ""
    ).trim();

    const password = String(
      body.password ?? ""
    );

    const role = String(
      body.role ?? "reader"
    ) as Role;

    const validRoles: Role[] = [
      "reader",
      "editor",
      "superuser",
    ];

    if (!email) {
      return NextResponse.json(
        {
          error:
            "El correo electrónico es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        {
          error:
            "El nombre del usuario es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe tener al menos 8 caracteres.",
        },
        { status: 400 }
      );
    }

    if (!validRoles.includes(role)) {
      return NextResponse.json(
        {
          error: "Rol inválido.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Crear usuario en Supabase Auth
    // --------------------------------------------------------

    const {
      data: createdAuth,
      error: createAuthError,
    } = await admin.auth.admin.createUser({
      email,
      password,

      email_confirm: true,

      user_metadata: {
        full_name: fullName,
      },
    });

    if (createAuthError || !createdAuth.user) {
      console.error(createAuthError);

      return NextResponse.json(
        {
          error:
            createAuthError?.message ??
            "No se pudo crear el usuario.",
        },
        { status: 400 }
      );
    }

    const newUserId = createdAuth.user.id;

    // --------------------------------------------------------
    // Crear / actualizar perfil
    // --------------------------------------------------------

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          full_name: fullName,
          role,
          active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      console.error(profileError);

      // Evitamos dejar un usuario Auth huérfano.
      await admin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        {
          error:
            "Se creó el usuario de autenticación, pero no se pudo crear su perfil. La operación fue revertida.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Auditoría
    // --------------------------------------------------------

    await writeAuditLog({
      request,
      admin,

      actorId: actor.id,
      actorEmail: actor.email ?? null,
      actorName: actorProfile.full_name,
      actorRole: actorProfile.role,

      action: "USER_CREATED",

      entityId: newUserId,
      entityLabel: email,

      newData: {
        id: newUserId,
        email,
        full_name: fullName,
        role,
        active: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,

        user: {
          id: newUserId,
          email,
          full_name: fullName,
          role,
          active: true,
          created_at:
            createdAuth.user.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/users:", error);

    return NextResponse.json(
      {
        error:
          "Error interno al crear usuario.",
      },
      { status: 500 }
    );
  }
}