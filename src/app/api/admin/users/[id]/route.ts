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
  const secretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Faltan variables privadas de Supabase."
    );
  }

  return createClient(
    url,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function getRequestIp(
  request: NextRequest
) {
  const forwarded =
    request.headers.get(
      "x-forwarded-for"
    );

  if (forwarded) {
    return (
      forwarded
        .split(",")[0]
        ?.trim() || null
    );
  }

  return request.headers.get(
    "x-real-ip"
  );
}

async function requireSuperuser(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    return {
      error: NextResponse.json(
        {
          error: "No autorizado.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const accessToken =
    authorization
      .slice(7)
      .trim();

  if (!accessToken) {
    return {
      error: NextResponse.json(
        {
          error: "Token inválido.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const admin =
    getAdminClient();

  const {
    data: { user },
    error: authError,
  } =
    await admin.auth.getUser(
      accessToken
    );

  if (
    authError ||
    !user
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            "Sesión inválida o expirada.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from("profiles")
    .select(
      "id, full_name, role, active"
    )
    .eq("id", user.id)
    .single<Profile>();

  if (
    profileError ||
    !profile ||
    profile.role !==
      "superuser" ||
    !profile.active
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            "No tienes permisos para administrar usuarios.",
        },
        {
          status: 403,
        }
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

  admin: ReturnType<
    typeof getAdminClient
  >;

  actorId: string;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string;

  action: string;

  entityId?: string | null;
  entityLabel?: string | null;

  oldData?: unknown;
  newData?: unknown;

  metadata?: Record<
    string,
    unknown
  >;
}) {
  const { error } =
    await admin
      .from("audit_log")
      .insert({
        actor_id:
          actorId,

        actor_email:
          actorEmail,

        actor_name:
          actorName,

        actor_role:
          actorRole,

        action,

        entity: "users",

        entity_id:
          entityId ?? null,

        entity_label:
          entityLabel ?? null,

        old_data:
          oldData ?? null,

        new_data:
          newData ?? null,

        metadata:
          metadata ?? {},

        ip_address:
          getRequestIp(
            request
          ),

        user_agent:
          request.headers.get(
            "user-agent"
          ),
      });

  if (error) {
    console.error(
      "Error audit_log:",
      error
    );
  }
}

// ============================================================
// PATCH /api/admin/users/[id]
// ============================================================

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const auth =
      await requireSuperuser(
        request
      );

    if ("error" in auth) {
      return auth.error;
    }

    const {
      admin,
      user: actor,
      profile:
        actorProfile,
    } = auth;

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID de usuario inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const {
      data:
        currentProfile,
      error:
        currentProfileError,
    } = await admin
      .from("profiles")
      .select(
        "id, full_name, role, active"
      )
      .eq("id", id)
      .single<Profile>();

    if (
      currentProfileError ||
      !currentProfile
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró el perfil del usuario.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data:
        currentAuthData,
      error:
        currentAuthError,
    } =
      await admin.auth.admin.getUserById(
        id
      );

    if (
      currentAuthError ||
      !currentAuthData.user
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró el usuario de autenticación.",
        },
        {
          status: 404,
        }
      );
    }

    const currentAuthUser =
      currentAuthData.user;

    const nextName =
      typeof body.full_name ===
      "string"
        ? body.full_name.trim()
        : currentProfile.full_name ??
          "";

    const nextRole =
      typeof body.role ===
      "string"
        ? (body.role as Role)
        : currentProfile.role;

    const nextActive =
      typeof body.active ===
      "boolean"
        ? body.active
        : currentProfile.active;

    const validRoles: Role[] =
      [
        "reader",
        "editor",
        "superuser",
      ];

    if (
      !validRoles.includes(
        nextRole
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Rol inválido.",
        },
        {
          status: 400,
        }
      );
    }

    if (!nextName) {
      return NextResponse.json(
        {
          error:
            "El nombre no puede quedar vacío.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // Evitar que el superuser se bloquee a sí mismo
    // --------------------------------------------------------

    if (
      id === actor.id &&
      (
        nextRole !==
          "superuser" ||
        !nextActive
      )
    ) {
      return NextResponse.json(
        {
          error:
            "No puedes quitarte a ti mismo el rol superuser ni desactivar tu propia cuenta.",
        },
        {
          status: 400,
        }
      );
    }

    const oldData = {
      id,

      email:
        currentAuthUser.email ??
        "",

      full_name:
        currentProfile.full_name,

      role:
        currentProfile.role,

      active:
        currentProfile.active,
    };

    // --------------------------------------------------------
    // Actualizar perfil
    // --------------------------------------------------------

    const {
      error:
        updateProfileError,
    } = await admin
      .from("profiles")
      .update({
        full_name:
          nextName,

        role:
          nextRole,

        active:
          nextActive,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);

    if (
      updateProfileError
    ) {
      console.error(
        updateProfileError
      );

      return NextResponse.json(
        {
          error:
            "No se pudo actualizar el perfil.",
        },
        {
          status: 500,
        }
      );
    }

    // Mantener metadata de Auth sincronizada
    const {
      error:
        authMetadataError,
    } =
      await admin.auth.admin.updateUserById(
        id,
        {
          user_metadata: {
            ...(
              currentAuthUser
                .user_metadata ??
              {}
            ),

            full_name:
              nextName,
          },
        }
      );

    if (
      authMetadataError
    ) {
      console.error(
        "No se pudo actualizar metadata Auth:",
        authMetadataError
      );
    }

    const newData = {
      id,

      email:
        currentAuthUser.email ??
        "",

      full_name:
        nextName,

      role:
        nextRole,

      active:
        nextActive,
    };

    // --------------------------------------------------------
    // Determinar acción
    // --------------------------------------------------------

    let action =
      "USER_UPDATED";

    if (
      currentProfile.role !==
      nextRole
    ) {
      action =
        "USER_ROLE_CHANGED";
    } else if (
      currentProfile.active &&
      !nextActive
    ) {
      action =
        "USER_DISABLED";
    } else if (
      !currentProfile.active &&
      nextActive
    ) {
      action =
        "USER_ENABLED";
    }

    await writeAuditLog({
      request,
      admin,

      actorId:
        actor.id,

      actorEmail:
        actor.email ??
        null,

      actorName:
        actorProfile.full_name,

      actorRole:
        actorProfile.role,

      action,

      entityId:
        id,

      entityLabel:
        currentAuthUser.email ??
        id,

      oldData,
      newData,
    });

    return NextResponse.json({
      ok: true,

      user: newData,
    });
  } catch (error) {
    console.error(
      "PATCH /api/admin/users/[id]:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno al actualizar usuario.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE /api/admin/users/[id]
// ============================================================

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const auth =
      await requireSuperuser(
        request
      );

    if ("error" in auth) {
      return auth.error;
    }

    const {
      admin,
      user: actor,
      profile:
        actorProfile,
    } = auth;

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID de usuario inválido.",
        },
        {
          status: 400,
        }
      );
    }

    // El administrador nunca puede borrarse a sí mismo.
    if (id === actor.id) {
      return NextResponse.json(
        {
          error:
            "No puedes eliminar tu propia cuenta.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data:
        authUserData,
      error:
        authUserError,
    } =
      await admin.auth.admin.getUserById(
        id
      );

    if (
      authUserError ||
      !authUserData.user
    ) {
      return NextResponse.json(
        {
          error:
            "Usuario no encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const targetUser =
      authUserData.user;

    const {
      data:
        targetProfile,
    } = await admin
      .from("profiles")
      .select(
        "id, full_name, role, active"
      )
      .eq("id", id)
      .maybeSingle<Profile>();

    const snapshot = {
      id,

      email:
        targetUser.email ??
        "",

      full_name:
        targetProfile?.full_name ??
        targetUser
          .user_metadata
          ?.full_name ??
        "",

      role:
        targetProfile?.role ??
        "reader",

      active:
        targetProfile?.active ??
        false,
    };

    // --------------------------------------------------------
    // Escribimos auditoría ANTES de borrar Auth
    // --------------------------------------------------------

    await writeAuditLog({
      request,
      admin,

      actorId:
        actor.id,

      actorEmail:
        actor.email ??
        null,

      actorName:
        actorProfile.full_name,

      actorRole:
        actorProfile.role,

      action:
        "USER_DELETED",

      entityId:
        id,

      entityLabel:
        targetUser.email ??
        id,

      oldData:
        snapshot,

      newData:
        null,
    });

    // --------------------------------------------------------
    // Eliminar usuario de Supabase Auth
    // --------------------------------------------------------

    const {
      error: deleteError,
    } =
      await admin.auth.admin.deleteUser(
        id
      );

    if (deleteError) {
      console.error(
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "No se pudo eliminar el usuario.",
        },
        {
          status: 500,
        }
      );
    }

    /*
      Si profiles.id tiene FK a auth.users(id) con ON DELETE CASCADE,
      Supabase eliminará automáticamente el perfil.

      Por seguridad hacemos también un delete explícito.
      Si ya fue eliminado por cascade, no pasa nada.
    */

    await admin
      .from("profiles")
      .delete()
      .eq("id", id);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/admin/users/[id]:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error interno al eliminar usuario.",
      },
      {
        status: 500,
      }
    );
  }
}