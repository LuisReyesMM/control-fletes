import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

function safeTokenCompare(
  receivedToken: string,
  expectedToken: string
) {
  const receivedBuffer =
    Buffer.from(receivedToken);

  const expectedBuffer =
    Buffer.from(expectedToken);

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

export async function GET(
  request: Request
) {
  try {
    // =====================================================
    // VARIABLES PRIVADAS
    // =====================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const excelToken =
      process.env.EXCEL_READONLY_TOKEN;

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !excelToken
    ) {
      console.error(
        "Faltan variables de entorno para Excel."
      );

      return Response.json(
        {
          ok: false,
          error:
            "Configuración del servidor incompleta.",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // AUTORIZACIÓN
    // =====================================================

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (!authorization) {
      return Response.json(
        {
          ok: false,
          error:
            "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const prefix =
      "Bearer ";

    if (
      !authorization.startsWith(
        prefix
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Formato de autorización inválido.",
        },
        {
          status: 401,
        }
      );
    }

    const receivedToken =
      authorization
        .slice(prefix.length)
        .trim();

    if (
      !safeTokenCompare(
        receivedToken,
        excelToken
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Token inválido.",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================================
    // CLIENTE SUPABASE PRIVADO
    // =====================================================

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    // =====================================================
    // CONSULTA SOLO LECTURA
    // =====================================================

    const {
      data,
      error,
    } = await supabase
      .from("freight_services")
      .select(`
        folio,
        service_date,
        unit,
        invoice,
        client,
        service_type,
        container,
        weight,
        destination,
        rodrigo_cash_freight,
        invoice_freight,
        carlos_cash_advance,
        carlos_invoice_payment,
        observations,
        created_at,
        updated_at
      `)
      .order(
        "service_date",
        {
          ascending: false,
        }
      )
      .order(
        "folio",
        {
          ascending: false,
        }
      );

    if (error) {
      console.error(
        "Error Supabase Excel:",
        error
      );

      return Response.json(
        {
          ok: false,
          error:
            "No se pudieron consultar los fletes.",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================================
    // FORMATO PARA EXCEL
    // =====================================================

    const rows =
      (data ?? []).map(
        (service) => ({
          Folio: `F-${String(
            service.folio
          ).padStart(4, "0")}`,

          Fecha:
            service.service_date,

          Unidad:
            service.unit ?? "",

          Factura:
            service.invoice ?? "",

          Cliente:
            service.client ?? "",

          Tipo:
            service.service_type ??
            "",

          Contenedor:
            service.container ??
            "",

          Peso:
            service.weight ?? null,

          Destino:
            service.destination ??
            "",

          Flete_Rodrigo:
            service.rodrigo_cash_freight ??
            0,

          Flete_Factura:
            service.invoice_freight ??
            0,

          Anticipo_Carlos:
            service.carlos_cash_advance ??
            0,

          Pago_Carlos:
            service.carlos_invoice_payment ??
            0,

          Observaciones:
            service.observations ??
            "",

          Creado:
            service.created_at,

          Actualizado:
            service.updated_at,
        })
      );

    // =====================================================
    // RESPUESTA
    // =====================================================

    return Response.json(
      {
        ok: true,

        generated_at:
          new Date().toISOString(),

        total:
          rows.length,

        data:
          rows,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error inesperado API Excel:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Error interno del servidor.",
      },
      {
        status: 500,
      }
    );
  }
}