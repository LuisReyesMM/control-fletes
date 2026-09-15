import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

type MainColumnSetting = {
  column_key: string;
  label: string;
  visible: boolean;
  sort_order: number;
};

type CustomFieldDefinition = {
  field_key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean";
  visible: boolean;
  required: boolean;
  sort_order: number;
};

type FreightService = {
  folio: number;
  service_date: string | null;
  unit: string | null;
  invoice: string | null;
  client: string | null;
  service_type: string | null;
  category: string | null;
  container: string | null;
  weight: number | null;
  destination: string | null;
  rodrigo_cash_freight: number | null;
  invoice_freight: number | null;
  carlos_cash_advance: number | null;
  carlos_invoice_payment: number | null;
  observations: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExcelValue =
  | string
  | number
  | boolean
  | null;

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

function normalizeCustomValue(
  value: unknown,
  fieldType: CustomFieldDefinition["field_type"]
): ExcelValue {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    if (fieldType === "number") {
      return 0;
    }

    return "";
  }

  if (fieldType === "number") {
    const numericValue = Number(value);

    return Number.isFinite(numericValue)
      ? numericValue
      : 0;
  }

  if (fieldType === "boolean") {
    if (
      value === true ||
      value === "true" ||
      value === 1 ||
      value === "1"
    ) {
      return "Sí";
    }

    if (
      value === false ||
      value === "false" ||
      value === 0 ||
      value === "0"
    ) {
      return "No";
    }

    return "";
  }

  return String(value);
}

function getMainColumnValue(
  service: FreightService,
  columnKey: string
): ExcelValue {
  switch (columnKey) {
    case "folio":
      return `F-${String(
        service.folio
      ).padStart(4, "0")}`;

    case "service_date":
      return service.service_date ?? "";

    case "unit":
      return service.unit ?? "";

    case "invoice":
      return service.invoice ?? "";

    case "client":
      return service.client ?? "";

    case "service_type":
      return service.service_type ?? "";

    case "category":
      return service.category ?? "";

    case "container":
      return service.container ?? "";

    case "weight":
      return service.weight ?? null;

    case "destination":
      return service.destination ?? "";

    case "rodrigo_cash_freight":
      return (
        service.rodrigo_cash_freight ??
        0
      );

    case "invoice_freight":
      return (
        service.invoice_freight ??
        0
      );

    case "carlos_cash_advance":
      return (
        service.carlos_cash_advance ??
        0
      );

    case "carlos_invoice_payment":
      return (
        service.carlos_invoice_payment ??
        0
      );

    case "observations":
      return service.observations ?? "";

    case "created_at":
      return service.created_at ?? "";

    case "updated_at":
      return service.updated_at ?? "";

    default:
      return "";
  }
}

export async function GET(
  request: Request
) {
  try {
    // =====================================================
    // VARIABLES DE ENTORNO
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
    // CLIENTE SUPABASE
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
    // CONFIGURACIÓN DE COLUMNAS PRINCIPALES
    // =====================================================

    const {
      data: mainColumnsData,
      error: mainColumnsError,
    } = await supabase
      .from(
        "freight_column_settings"
      )
      .select(`
        column_key,
        label,
        visible,
        sort_order
      `)
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

    if (mainColumnsError) {
      console.error(
        "Error cargando columnas principales:",
        mainColumnsError
      );

      return Response.json(
        {
          ok: false,
          error:
            "No se pudo cargar la configuración de columnas.",
        },
        {
          status: 500,
        }
      );
    }

    const mainColumns =
      (
        mainColumnsData ??
        []
      ) as MainColumnSetting[];

    // =====================================================
    // CAMPOS PERSONALIZADOS
    // =====================================================

    const {
      data: customFieldsData,
      error: customFieldsError,
    } = await supabase
      .from(
        "freight_custom_fields"
      )
      .select(`
        field_key,
        label,
        field_type,
        visible,
        required,
        sort_order
      `)
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

    if (customFieldsError) {
      console.error(
        "Error cargando campos personalizados:",
        customFieldsError
      );

      return Response.json(
        {
          ok: false,
          error:
            "No se pudieron cargar los campos personalizados.",
        },
        {
          status: 500,
        }
      );
    }

    const customFields =
      (
        customFieldsData ??
        []
      ) as CustomFieldDefinition[];

    // =====================================================
    // CONSULTA DE FLETES
    // =====================================================

    const {
      data: servicesData,
      error: servicesError,
    } = await supabase
      .from(
        "freight_services"
      )
      .select(`
        folio,
        service_date,
        unit,
        invoice,
        client,
        service_type,
        category,
        container,
        weight,
        destination,
        rodrigo_cash_freight,
        invoice_freight,
        carlos_cash_advance,
        carlos_invoice_payment,
        observations,
        custom_fields,
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

    if (servicesError) {
      console.error(
        "Error Supabase Excel:",
        servicesError
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

    const services =
      (
        servicesData ??
        []
      ) as FreightService[];

    // =====================================================
    // COLUMNAS VISIBLES
    // =====================================================

    const visibleMainColumns =
      mainColumns.filter(
        (column) =>
          column.visible
      );

    const visibleCustomFields =
      customFields.filter(
        (field) =>
          field.visible
      );

    // =====================================================
    // FORMATO DINÁMICO PARA EXCEL
    // =====================================================

    const rows =
      services.map(
        (service) => {
          const row:
            Record<
              string,
              ExcelValue
            > = {};

          // -----------------------------------------------
          // COLUMNAS PRINCIPALES
          // -----------------------------------------------

          for (
            const column
            of visibleMainColumns
          ) {
            row[
              column.label
            ] =
              getMainColumnValue(
                service,
                column.column_key
              );
          }

          // -----------------------------------------------
          // CAMPOS PERSONALIZADOS
          // -----------------------------------------------

          const customValues =
            service.custom_fields ??
            {};

          for (
            const field
            of visibleCustomFields
          ) {
            const value =
              customValues[
                field.field_key
              ];

            row[
              field.label
            ] =
              normalizeCustomValue(
                value,
                field.field_type
              );
          }

          return row;
        }
      );

    // =====================================================
    // METADATOS DE COLUMNAS
    // =====================================================

    const columns = [
      ...visibleMainColumns.map(
        (column) => ({
          type: "main",
          key:
            column.column_key,
          label:
            column.label,
          sort_order:
            column.sort_order,
        })
      ),

      ...visibleCustomFields.map(
        (field) => ({
          type: "custom",
          key:
            field.field_key,
          label:
            field.label,
          sort_order:
            field.sort_order,
        })
      ),
    ];

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

        columns,

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