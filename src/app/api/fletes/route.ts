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

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    supabaseUrl,
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
        ?.trim() ?? null
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
    !Number.isFinite(number)
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
    data: profile,
    error: profileError,
  } = await admin
    .from("profiles")
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
  request: NextRequest;

  admin:
    ReturnType<
      typeof getAdminClient
    >;

  actorId: string;

  actorEmail:
    | string
    | null;

  actorName:
    | string
    | null;

  actorRole: string;

  action: string;

  entityId?:
    | string
    | null;

  entityLabel?:
    | string
    | null;

  oldData?: unknown;

  newData?: unknown;

  metadata?:
    Record<
      string,
      unknown
    >;
}) {
  const {
    error,
  } = await admin
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
      "Error escribiendo audit_log:",
      error
    );

    throw new Error(
      "No se pudo registrar la auditoría."
    );
  }
}

// ============================================================
// POST /api/fletes
// EDITOR / SUPERUSER
// ============================================================

export async function POST(
  request: NextRequest
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
            "No tienes permisos para crear fletes.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as FreightPayload;

    const serviceDate =
      cleanText(
        body.service_date
      );

    if (!serviceDate) {
      return NextResponse.json(
        {
          error:
            "La fecha del servicio es obligatoria.",
        },
        {
          status: 400,
        }
      );
    }

    const customFields =
      body.custom_fields &&
      typeof body.custom_fields ===
        "object" &&
      !Array.isArray(
        body.custom_fields
      )
        ? body.custom_fields
        : {};

    const insertPayload = {
      service_date:
        serviceDate,

      unit:
        cleanText(
          body.unit
        ),

      invoice:
        cleanText(
          body.invoice
        ),

      client:
        cleanText(
          body.client
        ),

      service_type:
        cleanText(
          body.service_type
        ),

      category:
        cleanText(
          body.category
        ),

      container:
        cleanText(
          body.container
        ),

      weight:
        cleanNumber(
          body.weight
        ),

      destination:
        cleanText(
          body.destination
        ),

      rodrigo_cash_freight:
        cleanNumber(
          body.rodrigo_cash_freight
        ) ?? 0,

      invoice_freight:
        cleanNumber(
          body.invoice_freight
        ) ?? 0,

      carlos_cash_advance:
        cleanNumber(
          body.carlos_cash_advance
        ) ?? 0,

      carlos_invoice_payment:
        cleanNumber(
          body.carlos_invoice_payment
        ) ?? 0,

      observations:
        cleanText(
          body.observations
        ),

      custom_fields:
        customFields,

      created_by:
        user.id,

      updated_by:
        user.id,
    };

    const {
      data:
        createdFreight,
      error:
        createError,
    } = await admin
      .from(
        "freight_services"
      )
      .insert(
        insertPayload
      )
      .select("*")
      .single();

    if (
      createError ||
      !createdFreight
    ) {
      console.error(
        "Error creando flete:",
        createError
      );

      return NextResponse.json(
        {
          error:
            createError?.message ??
            "No se pudo crear el flete.",
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
          "FREIGHT_CREATED",

        entityId:
          String(
            createdFreight.id
          ),

        entityLabel:
          formatFolio(
            createdFreight.folio
          ),

        oldData:
          null,

        newData:
          createdFreight,

        metadata: {
          folio:
            createdFreight.folio,
        },
      });
    } catch (
      auditError
    ) {
      console.error(
        "Falló auditoría. Revirtiendo creación:",
        auditError
      );

      const {
        error:
          rollbackError,
      } = await admin
        .from(
          "freight_services"
        )
        .delete()
        .eq(
          "id",
          createdFreight.id
        );

      if (
        rollbackError
      ) {
        console.error(
          "También falló rollback:",
          rollbackError
        );
      }

      return NextResponse.json(
        {
          error:
            "No se pudo registrar la auditoría. La creación del flete fue cancelada.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,

        freight:
          createdFreight,

        folio:
          formatFolio(
            createdFreight.folio
          ),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/fletes:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Error interno al crear el flete.",
      },
      {
        status: 500,
      }
    );
  }
}