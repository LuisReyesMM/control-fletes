import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Role =
  | "reader"
  | "editor"
  | "superuser";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  active: boolean;
};

type FreightPayload = {
  service_date?: string | null;
  unit?: string | null;
  invoice?: string | null;
  client?: string | null;
  service_type?: string | null;
  category?: string | null;
  container?: string | null;
  weight?: number | null;
  destination?: string | null;
  rodrigo_cash_freight?: number | null;
  invoice_freight?: number | null;
  carlos_cash_advance?: number | null;
  carlos_invoice_payment?: number | null;
  observations?: string | null;
  custom_fields?: Record<string, unknown>;
};

function getAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !secretKey
  ) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,

        detectSessionInUrl:
          false,
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
        ?.trim() ??
      null
    );
  }

  return (
    request.headers.get(
      "x-real-ip"
    ) ?? null
  );
}

function formatFolio(
  folio:
    | number
    | string
    | null
    | undefined
) {
  if (
    folio === null ||
    folio === undefined
  ) {
    return null;
  }

  return `F-${String(
    folio
  ).padStart(4, "0")}`;
}

function cleanText(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text === ""
    ? null
    : text;
}

function cleanNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return number;
}

async function authenticateUser(
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
      error:
        NextResponse.json(
          {
            error:
              "No autorizado.",
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
      error:
        NextResponse.json(
          {
            error:
              "Token inválido.",
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
    data: {
      user,
    },
    error:
      authError,
  } =
    await admin.auth.getUser(
      accessToken
    );

  if (
    authError ||
    !user
  ) {
    return {
      error:
        NextResponse.json(
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
    data:
      profile,
    error:
      profileError,
  } = await admin
    .from(
      "profiles"
    )
    .select(
      "id, full_name, role, active"
    )
    .eq(
      "id",
      user.id
    )
    .single<Profile>();

  if (
    profileError ||
    !profile ||
    !profile.active
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Tu cuenta no tiene acceso al sistema.",
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
  request:
    NextRequest;

  admin:
    ReturnType<
      typeof getAdminClient
    >;

  actorId:
    string;

  actorEmail:
    | string
    | null;

  actorName:
    | string
    | null;

  actorRole:
    string;

  action:
    string;

  entityId?:
    | string
    | null;

  entityLabel?:
    | string
    | null;

  oldData?:
    unknown;

  newData?:
    unknown;

  metadata?:
    Record<
      string,
      unknown
    >;
}) {
  const {
    error,
  } =
    await admin
      .from(
        "audit_log"
      )
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

        entity:
          "freight_services",

        entity_id:
          entityId ??
          null,

        entity_label:
          entityLabel ??
          null,

        old_data:
          oldData ??
          null,

        new_data:
          newData ??
          null,

        metadata:
          metadata ??
          {},

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

    throw new Error(
      "No se pudo registrar la auditoría."
    );
  }
}

// ============================================================
// PATCH
// ============================================================

export async function PATCH(
  request:
    NextRequest,

  context: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  try {
    const auth =
      await authenticateUser(
        request
      );

    if (
      "error" in auth
    ) {
      return auth.error;
    }

    const {
      admin,
      user,
      profile,
    } = auth;

    if (
      profile.role !==
        "editor" &&
      profile.role !==
        "superuser"
    ) {
      return NextResponse.json(
        {
          error:
            "No tienes permisos para editar fletes.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      id,
    } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID de flete inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data:
        oldFreight,
      error:
        oldError,
    } = await admin
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
      oldError ||
      !oldFreight
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró el flete.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      (await request.json()) as FreightPayload;

    const updatePayload:
      Record<
        string,
        unknown
      > = {
        updated_by:
          user.id,

        updated_at:
          new Date().toISOString(),
      };

    if (
      "service_date" in
      body
    ) {
      const value =
        cleanText(
          body.service_date
        );

      if (!value) {
        return NextResponse.json(
          {
            error:
              "La fecha del servicio no puede quedar vacía.",
          },
          {
            status: 400,
          }
        );
      }

      updatePayload.service_date =
        value;
    }

    if (
      "unit" in body
    ) {
      updatePayload.unit =
        cleanText(
          body.unit
        );
    }

    if (
      "invoice" in body
    ) {
      updatePayload.invoice =
        cleanText(
          body.invoice
        );
    }

    if (
      "client" in body
    ) {
      updatePayload.client =
        cleanText(
          body.client
        );
    }

    if (
      "service_type" in
      body
    ) {
      updatePayload.service_type =
        cleanText(
          body.service_type
        );
    }

    if (
      "category" in body
    ) {
      updatePayload.category =
        cleanText(
          body.category
        );
    }

    if (
      "container" in
      body
    ) {
      updatePayload.container =
        cleanText(
          body.container
        );
    }

    if (
      "weight" in body
    ) {
      updatePayload.weight =
        cleanNumber(
          body.weight
        );
    }

    if (
      "destination" in
      body
    ) {
      updatePayload.destination =
        cleanText(
          body.destination
        );
    }

    if (
      "rodrigo_cash_freight" in
      body
    ) {
      updatePayload.rodrigo_cash_freight =
        cleanNumber(
          body.rodrigo_cash_freight
        ) ?? 0;
    }

    if (
      "invoice_freight" in
      body
    ) {
      updatePayload.invoice_freight =
        cleanNumber(
          body.invoice_freight
        ) ?? 0;
    }

    if (
      "carlos_cash_advance" in
      body
    ) {
      updatePayload.carlos_cash_advance =
        cleanNumber(
          body.carlos_cash_advance
        ) ?? 0;
    }

    if (
      "carlos_invoice_payment" in
      body
    ) {
      updatePayload.carlos_invoice_payment =
        cleanNumber(
          body.carlos_invoice_payment
        ) ?? 0;
    }

    if (
      "observations" in
      body
    ) {
      updatePayload.observations =
        cleanText(
          body.observations
        );
    }

    if (
      "custom_fields" in
      body
    ) {
      updatePayload.custom_fields =
        body.custom_fields &&
        typeof body.custom_fields ===
          "object" &&
        !Array.isArray(
          body.custom_fields
        )
          ? body.custom_fields
          : {};
    }

    const {
      data:
        updatedFreight,
      error:
        updateError,
    } = await admin
      .from(
        "freight_services"
      )
      .update(
        updatePayload
      )
      .eq(
        "id",
        id
      )
      .select("*")
      .single();

    if (
      updateError ||
      !updatedFreight
    ) {
      console.error(
        "Error actualizando flete:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError?.message ??
            "No se pudo actualizar el flete.",
        },
        {
          status: 500,
        }
      );
    }

    try {
      await writeAuditLog({
        request,
        admin,

        actorId:
          user.id,

        actorEmail:
          user.email ??
          null,

        actorName:
          profile.full_name,

        actorRole:
          profile.role,

        action:
          "FREIGHT_UPDATED",

        entityId:
          id,

        entityLabel:
          formatFolio(
            updatedFreight.folio
          ),

        oldData:
          oldFreight,

        newData:
          updatedFreight,

        metadata: {
          folio:
            updatedFreight.folio,
        },
      });
    } catch (
      auditError
    ) {
      console.error(
        "Falló auditoría. Revirtiendo actualización:",
        auditError
      );

      const rollbackPayload = {
        service_date:
          oldFreight.service_date,

        unit:
          oldFreight.unit,

        invoice:
          oldFreight.invoice,

        client:
          oldFreight.client,

        service_type:
          oldFreight.service_type,

        category:
          oldFreight.category,

        container:
          oldFreight.container,

        weight:
          oldFreight.weight,

        destination:
          oldFreight.destination,

        rodrigo_cash_freight:
          oldFreight.rodrigo_cash_freight,

        invoice_freight:
          oldFreight.invoice_freight,

        carlos_cash_advance:
          oldFreight.carlos_cash_advance,

        carlos_invoice_payment:
          oldFreight.carlos_invoice_payment,

        observations:
          oldFreight.observations,

        custom_fields:
          oldFreight.custom_fields,

        updated_by:
          oldFreight.updated_by,

        updated_at:
          oldFreight.updated_at,
      };

      const {
        error:
          rollbackError,
      } = await admin
        .from(
          "freight_services"
        )
        .update(
          rollbackPayload
        )
        .eq(
          "id",
          id
        );

      if (
        rollbackError
      ) {
        console.error(
          "Falló rollback del flete:",
          rollbackError
        );
      }

      return NextResponse.json(
        {
          error:
            "No se pudo registrar la auditoría. La modificación fue cancelada.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      freight:
        updatedFreight,

      folio:
        formatFolio(
          updatedFreight.folio
        ),
    });
  } catch (error) {
    console.error(
      "PATCH /api/fletes/[id]:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Error interno al actualizar el flete.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE
// ============================================================

export async function DELETE(
  request:
    NextRequest,

  context: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  try {
    const auth =
      await authenticateUser(
        request
      );

    if (
      "error" in auth
    ) {
      return auth.error;
    }

    const {
      admin,
      user,
      profile,
    } = auth;

    if (
      profile.role !==
      "superuser"
    ) {
      return NextResponse.json(
        {
          error:
            "Solo un superusuario puede eliminar fletes.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      id,
    } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "ID de flete inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data:
        oldFreight,
      error:
        oldError,
    } = await admin
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
      oldError ||
      !oldFreight
    ) {
      return NextResponse.json(
        {
          error:
            "No se encontró el flete.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error:
        deleteError,
    } = await admin
      .from(
        "freight_services"
      )
      .delete()
      .eq(
        "id",
        id
      );

    if (
      deleteError
    ) {
      return NextResponse.json(
        {
          error:
            deleteError.message ??
            "No se pudo eliminar el flete.",
        },
        {
          status: 500,
        }
      );
    }

    try {
      await writeAuditLog({
        request,
        admin,

        actorId:
          user.id,

        actorEmail:
          user.email ??
          null,

        actorName:
          profile.full_name,

        actorRole:
          profile.role,

        action:
          "FREIGHT_DELETED",

        entityId:
          id,

        entityLabel:
          formatFolio(
            oldFreight.folio
          ),

        oldData:
          oldFreight,

        newData:
          null,

        metadata: {
          folio:
            oldFreight.folio,
        },
      });
    } catch (
      auditError
    ) {
      console.error(
        "La eliminación ocurrió, pero falló la auditoría:",
        auditError
      );

      return NextResponse.json(
        {
          error:
            "El flete fue eliminado, pero hubo un problema al registrar la auditoría.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      deleted: {
        id,

        folio:
          formatFolio(
            oldFreight.folio
          ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Error interno al eliminar el flete.",
      },
      {
        status: 500,
      }
    );
  }
}