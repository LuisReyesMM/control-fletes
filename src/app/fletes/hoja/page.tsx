"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

type Role = "reader" | "editor" | "superuser";

type FreightService = {
  id: string;
  folio: number;
  service_date: string;
  unit: string | null;
  invoice: string | null;
  client: string | null;
  service_type: string | null;
  container: string | null;
  weight: number | null;
  destination: string | null;
  rodrigo_cash_freight: number | null;
  invoice_freight: number | null;
  carlos_cash_advance: number | null;
  carlos_invoice_payment: number | null;
  observations: string | null;
};

type CellMap = Record<string, string>;

type CellPosition = {
  row: number;
  col: number;
};

type SelectionRange = {
  start: CellPosition;
  end: CellPosition;
};

type CellFormat = {
  fontFamily?: string;
  bold?: boolean;
  textColor?: string;
  backgroundColor?: string;
};

type CellFormatMap = Record<string, CellFormat>;

const TOTAL_ROWS = 300;
const TOTAL_COLS = 40;

const ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 8;
const HISTORY_LIMIT = 60;

const OFFICIAL_COLUMNS = [
  "Folio",
  "Fecha",
  "Unidad",
  "Factura",
  "Cliente",
  "Tipo",
  "Contenedor",
  "Peso",
  "Destino",
  "Flete Rodrigo",
  "Flete factura",
  "Anticipo Carlos",
  "Pago Carlos",
  "Observaciones",
];

const FONT_OPTIONS = [
  "Arial",
  "Calibri",
  "Verdana",
  "Times New Roman",
  "Georgia",
  "Courier New",
];

export default function HojaTrabajoPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  // =========================================================
  // ESTADO GENERAL
  // =========================================================

  const [role, setRole] =
    useState<Role | null>(null);

  const [userId, setUserId] =
    useState("");

  const [services, setServices] =
    useState<FreightService[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    savedMessage,
    setSavedMessage,
  ] = useState("✓ Guardado local");

  // =========================================================
  // DATOS TEMPORALES
  // =========================================================

  const [cells, setCells] =
    useState<CellMap>({});

  const [
    cellFormats,
    setCellFormats,
  ] = useState<CellFormatMap>({});

  // =========================================================
  // SELECCIÓN
  // =========================================================

  const [
    selection,
    setSelection,
  ] = useState<SelectionRange | null>(
    null
  );

  const [
    formulaBar,
    setFormulaBar,
  ] = useState("");

  const [
    editingCell,
    setEditingCell,
  ] = useState<string | null>(
    null
  );

  const [
    isSelecting,
    setIsSelecting,
  ] = useState(false);

  // =========================================================
  // ARRASTRE DE FÓRMULAS
  // =========================================================

  const [
    fillSource,
    setFillSource,
  ] = useState<CellPosition | null>(
    null
  );

  const [
    fillTarget,
    setFillTarget,
  ] = useState<CellPosition | null>(
    null
  );

  // =========================================================
  // VIRTUALIZACIÓN
  // =========================================================

  const scrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [scrollTop, setScrollTop] =
    useState(0);

  const [
    viewportHeight,
    setViewportHeight,
  ] = useState(700);

  // =========================================================
  // REFS
  // =========================================================

  const cellRefs = useRef<
    Record<
      string,
      HTMLInputElement | null
    >
  >({});

  const undoStack =
    useRef<CellMap[]>([]);

  const redoStack =
    useRef<CellMap[]>([]);

  const editingSnapshot =
    useRef<CellMap | null>(null);

  // =========================================================
  // CARGAR USUARIO Y DATOS
  // =========================================================

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        !profile.active
      ) {
        router.replace("/login");
        return;
      }

      setRole(
        profile.role as Role
      );

      const {
        data: freightData,
        error: freightError,
      } = await supabase
        .from("freight_services")
        .select(`
          id,
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
          observations
        `)
        .order("service_date", {
          ascending: false,
        })
        .order("folio", {
          ascending: false,
        });

      if (freightError) {
        setErrorMessage(
          `No se pudieron cargar los fletes: ${freightError.message}`
        );

        setLoading(false);
        return;
      }

      setServices(
        (freightData ??
          []) as FreightService[]
      );

      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  // =========================================================
  // CARGAR CELDAS LOCALES
  // =========================================================

  useEffect(() => {
    if (!userId) {
      return;
    }

    const key =
      `control-fletes-spreadsheet-${userId}`;

    try {
      const saved =
        window.localStorage.getItem(
          key
        );

      if (saved) {
        setCells(
          JSON.parse(
            saved
          ) as CellMap
        );
      }
    } catch {
      setCells({});
    }
  }, [userId]);

  // =========================================================
  // CARGAR FORMATOS LOCALES
  // =========================================================

  useEffect(() => {
    if (!userId) {
      return;
    }

    const key =
      `control-fletes-spreadsheet-formats-${userId}`;

    try {
      const saved =
        window.localStorage.getItem(
          key
        );

      if (saved) {
        setCellFormats(
          JSON.parse(
            saved
          ) as CellFormatMap
        );
      }
    } catch {
      setCellFormats({});
    }
  }, [userId]);

  // =========================================================
  // AUTOGUARDAR CELDAS
  // =========================================================

  useEffect(() => {
    if (!userId) {
      return;
    }

    setSavedMessage(
      "Guardando..."
    );

    const timer =
      window.setTimeout(() => {
        try {
          window.localStorage.setItem(
            `control-fletes-spreadsheet-${userId}`,
            JSON.stringify(cells)
          );

          setSavedMessage(
            "✓ Guardado local"
          );
        } catch {
          setSavedMessage(
            "Error al guardar"
          );
        }
      }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cells, userId]);

  // =========================================================
  // AUTOGUARDAR FORMATOS
  // =========================================================

  useEffect(() => {
    if (!userId) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        try {
          window.localStorage.setItem(
            `control-fletes-spreadsheet-formats-${userId}`,
            JSON.stringify(
              cellFormats
            )
          );
        } catch {
          // El formato es auxiliar.
        }
      }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cellFormats, userId]);

  // =========================================================
  // MEDIR VIEWPORT
  // =========================================================

  useEffect(() => {
    const element =
      scrollRef.current;

    if (!element) {
      return;
    }

    function updateHeight() {
      if (!element) {
        return;
      }

      setViewportHeight(
        element.clientHeight
      );
    }

    updateHeight();

    const observer =
      new ResizeObserver(
        updateHeight
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  // =========================================================
  // NOMBRE DE COLUMNAS
  // =========================================================

  const columnName =
    useCallback(
      (index: number) => {
        let result = "";
        let value = index + 1;

        while (value > 0) {
          const remainder =
            (value - 1) % 26;

          result =
            String.fromCharCode(
              65 + remainder
            ) + result;

          value = Math.floor(
            (value - 1) / 26
          );
        }

        return result;
      },
      []
    );

  const columnIndex =
    useCallback(
      (name: string) => {
        let result = 0;

        for (
          let index = 0;
          index < name.length;
          index++
        ) {
          result =
            result * 26 +
            name.charCodeAt(
              index
            ) -
            64;
        }

        return result - 1;
      },
      []
    );

  const cellKey =
    useCallback(
      (
        row: number,
        col: number
      ) => {
        return `${columnName(
          col
        )}${row + 1}`;
      },
      [columnName]
    );

  const parseCellReference =
    useCallback(
      (reference: string) => {
        const match =
          reference
            .trim()
            .toUpperCase()
            .match(
              /^([A-Z]+)([0-9]+)$/
            );

        if (!match) {
          return null;
        }

        return {
          col: columnIndex(
            match[1]
          ),

          row:
            Number(match[2]) -
            1,
        };
      },
      [columnIndex]
    );

  // =========================================================
  // DATOS OFICIALES
  // =========================================================

  const officialCellValues =
    useMemo(() => {
      const result: CellMap =
        {};

      OFFICIAL_COLUMNS.forEach(
        (
          label,
          column
        ) => {
          result[
            cellKey(
              0,
              column
            )
          ] = label;
        }
      );

      services.forEach(
        (
          service,
          serviceIndex
        ) => {
          const row =
            serviceIndex + 1;

          const values = [
            `F-${String(
              service.folio
            ).padStart(4, "0")}`,

            formatDate(
              service.service_date
            ),

            service.unit ?? "",

            service.invoice ?? "",

            service.client ?? "",

            service.service_type ??
              "",

            service.container ?? "",

            service.weight === null
              ? ""
              : String(
                  service.weight
                ),

            service.destination ?? "",

            service.rodrigo_cash_freight ===
            null
              ? ""
              : String(
                  service.rodrigo_cash_freight
                ),

            service.invoice_freight ===
            null
              ? ""
              : String(
                  service.invoice_freight
                ),

            service.carlos_cash_advance ===
            null
              ? ""
              : String(
                  service.carlos_cash_advance
                ),

            service.carlos_invoice_payment ===
            null
              ? ""
              : String(
                  service.carlos_invoice_payment
                ),

            service.observations ??
              "",
          ];

          values.forEach(
            (
              value,
              column
            ) => {
              result[
                cellKey(
                  row,
                  column
                )
              ] = value;
            }
          );
        }
      );

      return result;
    }, [
      services,
      cellKey,
    ]);

  const isOfficialCell =
    useCallback(
      (
        row: number,
        col: number
      ) => {
        return (
          row <
            services.length +
              1 &&
          col <
            OFFICIAL_COLUMNS.length
        );
      },
      [services.length]
    );

  // =========================================================
  // OBTENER VALOR
  // =========================================================

  const getRawCellValue =
    useCallback(
      (
        row: number,
        col: number
      ) => {
        const key =
          cellKey(
            row,
            col
          );

        if (
          Object.prototype.hasOwnProperty.call(
            officialCellValues,
            key
          )
        ) {
          return (
            officialCellValues[
              key
            ] ?? ""
          );
        }

        return cells[key] ?? "";
      },
      [
        cells,
        officialCellValues,
        cellKey,
      ]
    );

  // =========================================================
  // CONVERTIR A NÚMERO
  // =========================================================

  const parseNumber =
    useCallback(
      (
        value: unknown
      ):
        | number
        | null => {
        if (
          value === "" ||
          value === null ||
          value ===
            undefined
        ) {
          return null;
        }

        const cleaned =
          String(value)
            .replace(
              /\$/g,
              ""
            )
            .replace(
              /,/g,
              ""
            )
            .trim();

        const number =
          Number(cleaned);

        return Number.isNaN(
          number
        )
          ? null
          : number;
      },
      []
    );

  // =========================================================
  // FÓRMULAS
  // =========================================================

  function getNumericCellValue(
    reference: string,
    visited = new Set<string>()
  ): number {
    const parsed =
      parseCellReference(
        reference
      );

    if (!parsed) {
      return 0;
    }

    const key =
      cellKey(
        parsed.row,
        parsed.col
      );

    if (visited.has(key)) {
      return 0;
    }

    visited.add(key);

    const raw =
      getRawCellValue(
        parsed.row,
        parsed.col
      );

    if (
      raw.startsWith("=")
    ) {
      const result =
        evaluateFormula(
          raw,
          visited
        );

      return (
        parseNumber(
          result
        ) ?? 0
      );
    }

    return (
      parseNumber(raw) ?? 0
    );
  }

  function expandRange(
    range: string
  ) {
    const [
      startReference,
      endReference,
    ] = range
      .toUpperCase()
      .split(":");

    const start =
      parseCellReference(
        startReference
      );

    const end =
      parseCellReference(
        endReference
      );

    if (!start || !end) {
      return [];
    }

    const values: number[] =
      [];

    const startRow =
      Math.min(
        start.row,
        end.row
      );

    const endRow =
      Math.max(
        start.row,
        end.row
      );

    const startCol =
      Math.min(
        start.col,
        end.col
      );

    const endCol =
      Math.max(
        start.col,
        end.col
      );

    for (
      let row = startRow;
      row <= endRow;
      row++
    ) {
      for (
        let col = startCol;
        col <= endCol;
        col++
      ) {
        values.push(
          getNumericCellValue(
            cellKey(
              row,
              col
            )
          )
        );
      }
    }

    return values;
  }

  function evaluateSimpleExpression(
    input: string,
    visited: Set<string>
  ) {
    let expression =
      input.toUpperCase();

    expression =
      expression.replace(
        /\^/g,
        "**"
      );

    expression =
      expression.replace(
        /\b([A-Z]+\d+)\b/g,
        (
          reference
        ) =>
          String(
            getNumericCellValue(
              reference,
              new Set(
                visited
              )
            )
          )
      );

    if (
      !/^[0-9+\-*/().\s*]+$/.test(
        expression
      )
    ) {
      return 0;
    }

    try {
      const result =
        Function(
          `"use strict"; return (${expression});`
        )();

      return typeof result ===
          "number" &&
        Number.isFinite(
          result
        )
        ? result
        : 0;
    } catch {
      return 0;
    }
  }

  function evaluateFormula(
    formula: string,
    visited = new Set<string>()
  ): string {
    try {
      let expression =
        formula
          .trim()
          .replace(
            /^=/,
            ""
          )
          .toUpperCase();

      expression =
        expression.replace(
          /\^/g,
          "**"
        );

      // SUMA
      expression =
        expression.replace(
          /(?:SUMA|SUM)\(([A-Z]+\d+:[A-Z]+\d+)\)/g,
          (
            _,
            range: string
          ) =>
            String(
              expandRange(
                range
              ).reduce(
                (
                  total,
                  value
                ) =>
                  total +
                  value,
                0
              )
            )
        );

      // PROMEDIO
      expression =
        expression.replace(
          /(?:PROMEDIO|AVERAGE)\(([A-Z]+\d+:[A-Z]+\d+)\)/g,
          (
            _,
            range: string
          ) => {
            const values =
              expandRange(
                range
              );

            if (
              values.length ===
              0
            ) {
              return "0";
            }

            return String(
              values.reduce(
                (
                  total,
                  value
                ) =>
                  total +
                  value,
                0
              ) /
                values.length
            );
          }
        );

      // MIN
      expression =
        expression.replace(
          /MIN\(([A-Z]+\d+:[A-Z]+\d+)\)/g,
          (
            _,
            range: string
          ) => {
            const values =
              expandRange(
                range
              );

            return String(
              values.length
                ? Math.min(
                    ...values
                  )
                : 0
            );
          }
        );

      // MAX
      expression =
        expression.replace(
          /MAX\(([A-Z]+\d+:[A-Z]+\d+)\)/g,
          (
            _,
            range: string
          ) => {
            const values =
              expandRange(
                range
              );

            return String(
              values.length
                ? Math.max(
                    ...values
                  )
                : 0
            );
          }
        );

      // CONTAR
      expression =
        expression.replace(
          /(?:CONTAR|COUNT)\(([A-Z]+\d+:[A-Z]+\d+)\)/g,
          (
            _,
            range: string
          ) =>
            String(
              expandRange(
                range
              ).length
            )
        );

      // ABS
      expression =
        expression.replace(
          /ABS\(([^()]+)\)/g,
          (
            _,
            inner: string
          ) =>
            String(
              Math.abs(
                evaluateSimpleExpression(
                  inner,
                  visited
                )
              )
            )
        );

      // REDONDEAR
      expression =
        expression.replace(
          /(?:REDONDEAR|ROUND)\(([^;,]+)[;,]\s*(\d+)\)/g,
          (
            _,
            inner: string,
            decimalText: string
          ) => {
            const value =
              evaluateSimpleExpression(
                inner,
                visited
              );

            const decimals =
              Number(
                decimalText
              );

            const factor =
              10 **
              decimals;

            return String(
              Math.round(
                value *
                  factor
              ) /
                factor
            );
          }
        );

      // CELDAS
      expression =
        expression.replace(
          /\b([A-Z]+\d+)\b/g,
          (
            reference
          ) =>
            String(
              getNumericCellValue(
                reference,
                new Set(
                  visited
                )
              )
            )
        );

      if (
        !/^[0-9+\-*/().\s*]+$/.test(
          expression
        )
      ) {
        return "#ERROR";
      }

      const result =
        Function(
          `"use strict"; return (${expression});`
        )();

      if (
        typeof result !==
          "number" ||
        !Number.isFinite(
          result
        )
      ) {
        return "#ERROR";
      }

      return String(
        result
      );
    } catch {
      return "#ERROR";
    }
  }

  function displayCellValue(
    row: number,
    col: number
  ) {
    const raw =
      getRawCellValue(
        row,
        col
      );

    if (
      !raw.startsWith("=")
    ) {
      return raw;
    }

    const result =
      evaluateFormula(raw);

    if (
      result === "#ERROR"
    ) {
      return result;
    }

    const number =
      Number(result);

    if (
      Number.isNaN(
        number
      )
    ) {
      return result;
    }

    return new Intl.NumberFormat(
      "es-MX",
      {
        maximumFractionDigits:
          6,
      }
    ).format(number);
  }

  // =========================================================
  // HISTORIAL
  // =========================================================

  function pushHistory(
    snapshot: CellMap
  ) {
    undoStack.current = [
      ...undoStack.current,
      snapshot,
    ].slice(
      -HISTORY_LIMIT
    );

    redoStack.current = [];
  }

  function beginEditing() {
    if (
      editingSnapshot.current
    ) {
      return;
    }

    editingSnapshot.current =
      { ...cells };
  }

  function finishEditing() {
    if (
      !editingSnapshot.current
    ) {
      return;
    }

    pushHistory(
      editingSnapshot.current
    );

    editingSnapshot.current =
      null;
  }

  const undo =
    useCallback(() => {
      const previous =
        undoStack.current.at(
          -1
        );

      if (!previous) {
        return;
      }

      redoStack.current.push({
        ...cells,
      });

      undoStack.current =
        undoStack.current.slice(
          0,
          -1
        );

      setCells(previous);
    }, [cells]);

  const redo =
    useCallback(() => {
      const next =
        redoStack.current.at(
          -1
        );

      if (!next) {
        return;
      }

      undoStack.current.push({
        ...cells,
      });

      redoStack.current =
        redoStack.current.slice(
          0,
          -1
        );

      setCells(next);
    }, [cells]);

  // =========================================================
  // CTRL+Z / CTRL+Y
  // =========================================================

  useEffect(() => {
    function handleKeyboard(
      event: globalThis.KeyboardEvent
    ) {
      if (
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }

      const key =
        event.key.toLowerCase();

      if (
        key === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        undo();
      }

      if (
        key === "y" ||
        (key === "z" &&
          event.shiftKey)
      ) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
    };
  }, [undo, redo]);

  // =========================================================
  // SELECCIÓN NORMALIZADA
  // =========================================================

  const normalizedRange =
    useCallback(() => {
      if (!selection) {
        return null;
      }

      return {
        startRow:
          Math.min(
            selection.start
              .row,
            selection.end.row
          ),

        endRow:
          Math.max(
            selection.start
              .row,
            selection.end.row
          ),

        startCol:
          Math.min(
            selection.start
              .col,
            selection.end.col
          ),

        endCol:
          Math.max(
            selection.start
              .col,
            selection.end.col
          ),
      };
    }, [selection]);

  const isCellSelected =
    useCallback(
      (
        row: number,
        col: number
      ) => {
        const range =
          normalizedRange();

        if (!range) {
          return false;
        }

        return (
          row >=
            range.startRow &&
          row <=
            range.endRow &&
          col >=
            range.startCol &&
          col <=
            range.endCol
        );
      },
      [normalizedRange]
    );

  // =========================================================
  // INICIAR SELECCIÓN
  // =========================================================

  function startSelection(
    row: number,
    col: number,
    event: MouseEvent
  ) {
    if (
      event.shiftKey &&
      selection
    ) {
      setSelection({
        start:
          selection.start,

        end: {
          row,
          col,
        },
      });
    } else {
      setSelection({
        start: {
          row,
          col,
        },

        end: {
          row,
          col,
        },
      });
    }

    setFormulaBar(
      getRawCellValue(
        row,
        col
      )
    );

    setIsSelecting(
      true
    );
  }

  function extendSelection(
    row: number,
    col: number
  ) {
    if (!isSelecting) {
      return;
    }

    setSelection(
      (
        current
      ) => {
        if (!current) {
          return null;
        }

        if (
          current.end.row ===
            row &&
          current.end.col ===
            col
        ) {
          return current;
        }

        return {
          ...current,

          end: {
            row,
            col,
          },
        };
      }
    );
  }

  useEffect(() => {
    function stopSelection() {
      setIsSelecting(
        false
      );
    }

    window.addEventListener(
      "mouseup",
      stopSelection
    );

    return () => {
      window.removeEventListener(
        "mouseup",
        stopSelection
      );
    };
  }, []);

  // =========================================================
  // ESTADÍSTICAS DE SELECCIÓN
  // =========================================================

  const selectionStats =
    useMemo(() => {
      const range =
        normalizedRange();

      if (!range) {
        return null;
      }

      const numbers: number[] =
        [];

      let selectedCount = 0;

      for (
        let row =
          range.startRow;
        row <=
        range.endRow;
        row++
      ) {
        for (
          let col =
            range.startCol;
          col <=
          range.endCol;
          col++
        ) {
          selectedCount++;

          const number =
            parseNumber(
              displayCellValue(
                row,
                col
              )
            );

          if (
            number !== null
          ) {
            numbers.push(
              number
            );
          }
        }
      }

      const sum =
        numbers.reduce(
          (
            total,
            value
          ) =>
            total +
            value,
          0
        );

      return {
        selectedCount,

        numericCount:
          numbers.length,

        sum,

        average:
          numbers.length
            ? sum /
              numbers.length
            : 0,

        min:
          numbers.length
            ? Math.min(
                ...numbers
              )
            : null,

        max:
          numbers.length
            ? Math.max(
                ...numbers
              )
            : null,
      };
    }, [
      selection,
      cells,
      officialCellValues,
      normalizedRange,
      parseNumber,
    ]);

  // =========================================================
  // FORMATO DE CELDAS
  // =========================================================

  function getSelectedCellFormat():
    CellFormat {
    if (!selection) {
      return {};
    }

    const key =
      cellKey(
        selection.start.row,
        selection.start.col
      );

    return (
      cellFormats[key] ?? {}
    );
  }

  function applyFormatToSelection(
    changes: Partial<CellFormat>
  ) {
    const range =
      normalizedRange();

    if (!range) {
      return;
    }

    setCellFormats(
      (current) => {
        const next = {
          ...current,
        };

        for (
          let row =
            range.startRow;
          row <=
          range.endRow;
          row++
        ) {
          for (
            let col =
              range.startCol;
            col <=
            range.endCol;
            col++
          ) {
            const key =
              cellKey(
                row,
                col
              );

            next[key] = {
              ...(next[key] ??
                {}),
              ...changes,
            };
          }
        }

        return next;
      }
    );
  }

  function clearFormatFromSelection() {
    const range =
      normalizedRange();

    if (!range) {
      return;
    }

    setCellFormats(
      (current) => {
        const next = {
          ...current,
        };

        for (
          let row =
            range.startRow;
          row <=
          range.endRow;
          row++
        ) {
          for (
            let col =
              range.startCol;
            col <=
            range.endCol;
            col++
          ) {
            delete next[
              cellKey(
                row,
                col
              )
            ];
          }
        }

        return next;
      }
    );
  }

  const selectedFormat =
    getSelectedCellFormat();

  // =========================================================
  // FOCO
  // =========================================================

  function focusCell(
  row: number,
  col: number
) {
  const safeRow = Math.max(
    0,
    Math.min(TOTAL_ROWS - 1, row)
  );

  const safeCol = Math.max(
    0,
    Math.min(TOTAL_COLS - 1, col)
  );

  const container =
    scrollRef.current;

  if (container) {
    const rowTop =
      safeRow * ROW_HEIGHT;

    const rowBottom =
      rowTop + ROW_HEIGHT;

    if (
      rowTop <
      container.scrollTop
    ) {
      container.scrollTop =
        rowTop;
    } else if (
      rowBottom >
      container.scrollTop +
        container.clientHeight
    ) {
      container.scrollTop =
        rowBottom -
        container.clientHeight;
    }
  }

  setSelection({
    start: {
      row: safeRow,
      col: safeCol,
    },
    end: {
      row: safeRow,
      col: safeCol,
    },
  });

  setFormulaBar(
    getRawCellValue(
      safeRow,
      safeCol
    )
  );

  requestAnimationFrame(() => {
    const key = cellKey(
      safeRow,
      safeCol
    );

    cellRefs.current[key]?.focus();
  });
}

  // =========================================================
  // TECLADO
  // =========================================================

  function handleCellKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  row: number,
  col: number
) {
  const key = event.key;

  if (key === "Enter") {
    event.preventDefault();

    finishEditing();
    setEditingCell(null);

    focusCell(row + 1, col);
    return;
  }

  if (key === "Tab") {
    event.preventDefault();

    finishEditing();
    setEditingCell(null);

    focusCell(
      row,
      col + (event.shiftKey ? -1 : 1)
    );

    return;
  }

  if (key === "ArrowUp") {
    event.preventDefault();

    finishEditing();
    setEditingCell(null);

    focusCell(row - 1, col);
    return;
  }

  if (key === "ArrowDown") {
    event.preventDefault();

    finishEditing();
    setEditingCell(null);

    focusCell(row + 1, col);
    return;
  }

  if (key === "ArrowLeft") {
    event.preventDefault();

    finishEditing();
    setEditingCell(null);

    focusCell(row, col - 1);
    return;
  }

  if (key === "ArrowRight") {
    event.preventDefault();

    finishEditing();
    setEditingCell(null);

    focusCell(row, col + 1);
    return;
  }
}
  // =========================================================
  // APLICAR BARRA FX
  // =========================================================

  function applyFormulaBar() {
    if (!selection) {
      return;
    }

    const {
      row,
      col,
    } =
      selection.start;

    if (
      isOfficialCell(
        row,
        col
      )
    ) {
      return;
    }

    pushHistory({
      ...cells,
    });

    const key =
      cellKey(
        row,
        col
      );

    setCells(
      (
        current
      ) => ({
        ...current,

        [key]:
          formulaBar,
      })
    );
  }

  // =========================================================
  // PEGAR DESDE EXCEL
  // =========================================================

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) {
    const text =
      event.clipboardData.getData(
        "text"
      );

    if (
      !text.includes("\t") &&
      !text.includes("\n")
    ) {
      return;
    }

    event.preventDefault();

    pushHistory({
      ...cells,
    });

    const rows =
      text
        .replace(/\r/g, "")
        .split("\n");

    setCells(
      (
        current
      ) => {
        const next = {
          ...current,
        };

        rows.forEach(
          (
            pastedRow,
            rowOffset
          ) => {
            const columns =
              pastedRow.split(
                "\t"
              );

            columns.forEach(
              (
                value,
                colOffset
              ) => {
                const targetRow =
                  row +
                  rowOffset;

                const targetCol =
                  col +
                  colOffset;

                if (
                  targetRow >=
                    TOTAL_ROWS ||
                  targetCol >=
                    TOTAL_COLS ||
                  isOfficialCell(
                    targetRow,
                    targetCol
                  )
                ) {
                  return;
                }

                next[
                  cellKey(
                    targetRow,
                    targetCol
                  )
                ] = value;
              }
            );
          }
        );

        return next;
      }
    );
  }

  // =========================================================
  // AJUSTAR FÓRMULA AL ARRASTRAR
  // =========================================================

  function shiftFormula(
    formula: string,
    rowDelta: number,
    colDelta: number
  ) {
    if (
      !formula.startsWith("=")
    ) {
      return formula;
    }

    return formula.replace(
      /\b([A-Z]+)(\d+)\b/g,
      (
        _,
        colLetters: string,
        rowText: string
      ) => {
        const oldCol =
          columnIndex(
            colLetters
          );

        const oldRow =
          Number(
            rowText
          ) - 1;

        const newCol =
          Math.max(
            0,
            oldCol +
              colDelta
          );

        const newRow =
          Math.max(
            0,
            oldRow +
              rowDelta
          );

        return `${columnName(
          newCol
        )}${newRow + 1}`;
      }
    );
  }

  function beginFill(
    source: CellPosition,
    event: MouseEvent
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      isOfficialCell(
        source.row,
        source.col
      )
    ) {
      return;
    }

    setFillSource(
      source
    );

    setFillTarget(
      source
    );
  }

  function updateFillTarget(
    row: number,
    col: number
  ) {
    if (
      !fillSource
    ) {
      return;
    }

    setFillTarget(
      (
        current
      ) => {
        if (
          current?.row ===
            row &&
          current?.col ===
            col
        ) {
          return current;
        }

        return {
          row,
          col,
        };
      }
    );
  }

  const applyFill =
    useCallback(() => {
      if (
        !fillSource ||
        !fillTarget
      ) {
        return;
      }

      if (
        fillSource.row ===
          fillTarget.row &&
        fillSource.col ===
          fillTarget.col
      ) {
        setFillSource(null);
        setFillTarget(null);
        return;
      }

      const sourceValue =
        getRawCellValue(
          fillSource.row,
          fillSource.col
        );

      pushHistory({
        ...cells,
      });

      const startRow =
        Math.min(
          fillSource.row,
          fillTarget.row
        );

      const endRow =
        Math.max(
          fillSource.row,
          fillTarget.row
        );

      const startCol =
        Math.min(
          fillSource.col,
          fillTarget.col
        );

      const endCol =
        Math.max(
          fillSource.col,
          fillTarget.col
        );

      setCells(
        (
          current
        ) => {
          const next = {
            ...current,
          };

          for (
            let row =
              startRow;
            row <= endRow;
            row++
          ) {
            for (
              let col =
                startCol;
              col <= endCol;
              col++
            ) {
              if (
                row ===
                  fillSource.row &&
                col ===
                  fillSource.col
              ) {
                continue;
              }

              if (
                isOfficialCell(
                  row,
                  col
                )
              ) {
                continue;
              }

              next[
                cellKey(
                  row,
                  col
                )
              ] =
                shiftFormula(
                  sourceValue,
                  row -
                    fillSource.row,
                  col -
                    fillSource.col
                );
            }
          }

          return next;
        }
      );

      setSelection({
        start:
          fillSource,

        end:
          fillTarget,
      });

      setFillSource(
        null
      );

      setFillTarget(
        null
      );
    }, [
      fillSource,
      fillTarget,
      cells,
      getRawCellValue,
      isOfficialCell,
      cellKey,
      columnIndex,
      columnName,
    ]);

  useEffect(() => {
    function finishFill() {
      if (
        fillSource
      ) {
        applyFill();
      }
    }

    window.addEventListener(
      "mouseup",
      finishFill
    );

    return () => {
      window.removeEventListener(
        "mouseup",
        finishFill
      );
    };
  }, [
    fillSource,
    applyFill,
  ]);

  // =========================================================
  // LIMPIAR HOJA
  // =========================================================

  function clearSpreadsheet() {
    const confirmed =
      window.confirm(
        "¿Eliminar todas tus celdas temporales y formatos?\n\nLos datos oficiales de Supabase no serán modificados."
      );

    if (!confirmed) {
      return;
    }

    pushHistory({
      ...cells,
    });

    setCells({});
    setCellFormats({});
    setSelection(null);
    setFormulaBar("");

    if (userId) {
      window.localStorage.removeItem(
        `control-fletes-spreadsheet-${userId}`
      );

      window.localStorage.removeItem(
        `control-fletes-spreadsheet-formats-${userId}`
      );
    }
  }

  // =========================================================
  // FILAS VIRTUALES
  // =========================================================

  const visibleRange =
    useMemo(() => {
      const visibleRowCount =
        Math.ceil(
          viewportHeight /
            ROW_HEIGHT
        );

      const start =
        Math.max(
          0,
          Math.floor(
            scrollTop /
              ROW_HEIGHT
          ) -
            OVERSCAN_ROWS
        );

      const end =
        Math.min(
          TOTAL_ROWS - 1,
          start +
            visibleRowCount +
            OVERSCAN_ROWS *
              2
        );

      return {
        start,
        end,
      };
    }, [
      scrollTop,
      viewportHeight,
    ]);

  const visibleRows =
    useMemo(
      () =>
        Array.from(
          {
            length:
              visibleRange.end -
              visibleRange.start +
              1,
          },
          (
            _,
            index
          ) =>
            visibleRange.start +
            index
        ),
      [visibleRange]
    );

  const topSpacerHeight =
    visibleRange.start *
    ROW_HEIGHT;

  const bottomSpacerHeight =
    Math.max(
      0,
      (TOTAL_ROWS -
        visibleRange.end -
        1) *
        ROW_HEIGHT
    );

  // =========================================================
  // NOMBRE DE SELECCIÓN
  // =========================================================

  const currentRange =
    normalizedRange();

  const selectionName =
    currentRange
      ? currentRange.startRow ===
          currentRange.endRow &&
        currentRange.startCol ===
          currentRange.endCol
        ? cellKey(
            currentRange.startRow,
            currentRange.startCol
          )
        : `${cellKey(
            currentRange.startRow,
            currentRange.startCol
          )}:${cellKey(
            currentRange.endRow,
            currentRange.endCol
          )}`
      : "—";

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-slate-600 dark:text-slate-300">
            Cargando hoja de cálculo...
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="shrink-0 border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
  <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
    {/* IZQUIERDA */}

    <div className="flex items-start gap-4">
      {/* BOTÓN VOLVER */}

      <button
  type="button"
  onClick={() =>
    router.push("/fletes")
  }
  title="Volver a la relación de fletes"
  className="
    group
    inline-flex
    items-center
    justify-center
    text-4xl
    font-bold
    text-slate-600
    transition-all
    hover:-translate-x-1
    hover:text-slate-900
    active:scale-95
    dark:text-slate-300
    dark:hover:text-white
  "
>
  <span className="leading-none transition-transform group-hover:-translate-x-0.5">
    ←
  </span>
</button>

      {/* TÍTULO */}

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Hoja de cálculo
          </h1>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {savedMessage}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Trabaja libremente sin modificar los datos oficiales.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            🔒 Datos protegidos
          </span>

          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
            ✎ Área personal
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            Rol: {role}
          </span>
        </div>
      </div>
    </div>

    {/* DERECHA */}

    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={undo}
        title="Deshacer (Ctrl + Z)"
        className="
          inline-flex
          h-11
          items-center
          gap-2
          rounded-xl
          border
          border-slate-300
          bg-white
          px-4
          text-sm
          font-semibold
          text-slate-700
          shadow-sm
          transition
          hover:bg-slate-100
          disabled:cursor-not-allowed
          disabled:opacity-40
          dark:border-slate-700
          dark:bg-slate-900
          dark:text-slate-200
          dark:hover:bg-slate-800
        "
      >
        <span className="text-lg">↶</span>
        Deshacer
      </button>

      <button
        type="button"
        onClick={redo}
        title="Rehacer (Ctrl + Y)"
        className="
          inline-flex
          h-11
          items-center
          gap-2
          rounded-xl
          border
          border-slate-300
          bg-white
          px-4
          text-sm
          font-semibold
          text-slate-700
          shadow-sm
          transition
          hover:bg-slate-100
          disabled:cursor-not-allowed
          disabled:opacity-40
          dark:border-slate-700
          dark:bg-slate-900
          dark:text-slate-200
          dark:hover:bg-slate-800
        "
      >
        <span className="text-lg">↷</span>
        Rehacer
      </button>

      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

      <ThemeToggle />

      <button
        type="button"
        onClick={clearSpreadsheet}
        className="
          inline-flex
          h-11
          items-center
          gap-2
          rounded-xl
          border
          border-red-200
          bg-red-50
          px-4
          text-sm
          font-semibold
          text-red-600
          transition
          hover:border-red-300
          hover:bg-red-100
          dark:border-red-900
          dark:bg-red-950/20
          dark:text-red-400
          dark:hover:bg-red-950/40
        "
      >
        <span>⌫</span>
        Limpiar hoja
      </button>
    </div>
  </div>
</header>

      {/* =====================================================
          AYUDA
      ====================================================== */}

      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
    <span>
      <strong>Fórmulas:</strong>
    </span>

    <code>=H2*H3</code>
    <code>=SUMA(H2:H20)</code>
    <code>=PROMEDIO(H2:H20)</code>

    <span className="text-blue-500 dark:text-blue-400">
      Selecciona varias celdas para aplicar formato al mismo tiempo.
    </span>
  </div>
</div>

      {/* =====================================================
          BARRA DE FORMATO
      ====================================================== */}

      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* FUENTE */}

        <select
          disabled={!selection}
          value={
            selectedFormat.fontFamily ??
            "Arial"
          }
          onChange={(event) =>
            applyFormatToSelection({
              fontFamily:
                event.target.value,
            })
          }
          className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
        >
          {FONT_OPTIONS.map(
            (font) => (
              <option
                key={font}
                value={font}
              >
                {font}
              </option>
            )
          )}
        </select>

        {/* NEGRITA */}

        <button
          type="button"
          disabled={!selection}
          onClick={() =>
            applyFormatToSelection({
              bold:
                !selectedFormat.bold,
            })
          }
          title="Negrita"
          className={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold transition disabled:opacity-40 ${
            selectedFormat.bold
              ? "border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          }`}
        >
          B
        </button>

        {/* COLOR TEXTO */}

        <label
          title="Color del texto"
          className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
        >
          <span className="text-base font-bold">
            A
          </span>

          <input
            type="color"
            disabled={!selection}
            value={
              selectedFormat.textColor ??
              "#000000"
            }
            onChange={(event) =>
              applyFormatToSelection({
                textColor:
                  event.target.value,
              })
            }
            className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-40"
          />
        </label>

        {/* RELLENO */}

        <label
          title="Color de relleno"
          className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
        >
          <span className="text-base">
            ▣
          </span>

          <input
            type="color"
            disabled={!selection}
            value={
              selectedFormat.backgroundColor ??
              "#ffffff"
            }
            onChange={(event) =>
              applyFormatToSelection({
                backgroundColor:
                  event.target.value,
              })
            }
            className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-40"
          />
        </label>

        {/* QUITAR FORMATO */}

        <button
          type="button"
          disabled={!selection}
          onClick={
            clearFormatFromSelection
          }
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Quitar formato
        </button>

        <div className="ml-auto hidden text-xs text-slate-400 lg:block">
          El formato es personal y no modifica Supabase
        </div>
      </div>

      {/* =====================================================
          BARRA DE FÓRMULAS
      ====================================================== */}

      <div className="shrink-0 flex items-center gap-2 border-b border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <div className="w-28 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-center font-mono text-sm font-bold dark:border-slate-700 dark:bg-slate-800">
          {selectionName}
        </div>

        <div className="font-serif text-lg font-bold text-slate-500">
          fx
        </div>

        <input
          type="text"
          value={
            formulaBar
          }
          disabled={
            !selection ||
            isOfficialCell(
              selection.start.row,
              selection.start.col
            )
          }
          onChange={(
            event: ChangeEvent<HTMLInputElement>
          ) =>
            setFormulaBar(
              event.target.value
            )
          }
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
              "Enter"
            ) {
              applyFormulaBar();
            }
          }}
          placeholder="Ej. =K2-L2 o =SUMA(H2:H20)"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 disabled:opacity-50"
        />

        <button
          type="button"
          disabled={
            !selection ||
            isOfficialCell(
              selection.start.row,
              selection.start.col
            )
          }
          onClick={
            applyFormulaBar
          }
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
        >
          Aplicar
        </button>
      </div>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {errorMessage && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* =====================================================
          HOJA
      ====================================================== */}

      <div
        ref={scrollRef}
        onScroll={(
          event
        ) => {
          setScrollTop(
            event.currentTarget
              .scrollTop
          );
        }}
        className="min-h-0 flex-1 overflow-auto bg-white dark:bg-slate-950"
      >
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 h-8 w-12 min-w-12 border border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />

              {Array.from(
                {
                  length:
                    TOTAL_COLS,
                },
                (
                  _,
                  col
                ) => (
                  <th
                    key={col}
                    className="h-8 min-w-[140px] border border-slate-300 bg-slate-200 px-2 text-center font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {columnName(
                      col
                    )}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {/* ESPACIADOR SUPERIOR */}

            {topSpacerHeight >
              0 && (
              <tr>
                <td
                  colSpan={
                    TOTAL_COLS +
                    1
                  }
                  style={{
                    height:
                      topSpacerHeight,
                  }}
                  className="border-0 p-0"
                />
              </tr>
            )}

            {/* FILAS VISIBLES */}

            {visibleRows.map(
              (row) => (
                <tr
                  key={row}
                  style={{
                    height:
                      ROW_HEIGHT,
                  }}
                >
                  <th className="sticky left-0 z-10 h-9 w-12 min-w-12 border border-slate-300 bg-slate-200 text-center font-normal dark:border-slate-700 dark:bg-slate-800">
                    {row + 1}
                  </th>

                  {Array.from(
                    {
                      length:
                        TOTAL_COLS,
                    },
                    (
                      _,
                      col
                    ) => {
                      const key =
                        cellKey(
                          row,
                          col
                        );

                      const official =
                        isOfficialCell(
                          row,
                          col
                        );

                      const selected =
                        isCellSelected(
                          row,
                          col
                        );

                      const raw =
                        getRawCellValue(
                          row,
                          col
                        );

                      const displayed =
                        displayCellValue(
                          row,
                          col
                        );

                      const editing =
                        editingCell ===
                        key;

                      const cellFormat =
                        cellFormats[
                          key
                        ] ?? {};

                      const isMainCell =
                        selection?.start.row ===
                          row &&
                        selection?.start.col ===
                          col;

                      const isFillPreview =
                        fillSource &&
                        fillTarget &&
                        row >=
                          Math.min(
                            fillSource.row,
                            fillTarget.row
                          ) &&
                        row <=
                          Math.max(
                            fillSource.row,
                            fillTarget.row
                          ) &&
                        col >=
                          Math.min(
                            fillSource.col,
                            fillTarget.col
                          ) &&
                        col <=
                          Math.max(
                            fillSource.col,
                            fillTarget.col
                          );

                      return (
                        <td
                          key={key}
                          onMouseEnter={() => {
                            extendSelection(
                              row,
                              col
                            );

                            updateFillTarget(
                              row,
                              col
                            );
                          }}
                          className={`
                            relative
                            h-9
                            min-w-[140px]
                            border
                            border-slate-300
                            p-0
                            dark:border-slate-700

                            ${
                              official
                                ? "bg-emerald-50 dark:bg-emerald-950/20"
                                : "bg-white dark:bg-slate-950"
                            }

                            ${
                              selected
                                ? "ring-1 ring-inset ring-blue-300"
                                : ""
                            }

                            ${
                              isFillPreview
                                ? "bg-blue-100/70 dark:bg-blue-900/30"
                                : ""
                            }

                            ${
                              isMainCell
                                ? "ring-2 ring-inset ring-blue-600"
                                : ""
                            }
                          `}
                        >
                          <input
                            ref={(
                              element
                            ) => {
                              cellRefs.current[
                                key
                              ] =
                                element;
                            }}
                            type="text"
                            readOnly={
                              official
                            }
                            value={
                              editing &&
                              !official
                                ? raw
                                : displayed
                            }
                            style={{
                              fontFamily:
                                cellFormat.fontFamily ??
                                undefined,

                              fontWeight:
                                cellFormat.bold
                                  ? 700
                                  : undefined,

                              color:
                                cellFormat.textColor ??
                                undefined,

                              backgroundColor:
                                cellFormat.backgroundColor ??
                                undefined,
                            }}
                            onMouseDown={(
                              event
                            ) =>
                              startSelection(
                                row,
                                col,
                                event
                              )
                            }
                            onFocus={() => {
                              setFormulaBar(
                                raw
                              );

                              if (
                                !official
                              ) {
                                beginEditing();

                                setEditingCell(
                                  key
                                );
                              }
                            }}
                            onBlur={() => {
                              if (
                                editingCell ===
                                key
                              ) {
                                finishEditing();
                              }

                              setEditingCell(
                                null
                              );
                            }}
                            onChange={(
                              event
                            ) => {
                              if (
                                official
                              ) {
                                return;
                              }

                              const value =
                                event.target
                                  .value;

                              setCells(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  [key]:
                                    value,
                                })
                              );

                              setFormulaBar(
                                value
                              );
                            }}
                            onKeyDown={(
                              event
                            ) =>
                              handleCellKeyDown(
                                event,
                                row,
                                col
                              )
                            }
                            onPaste={(
                              event
                            ) =>
                              handlePaste(
                                event,
                                row,
                                col
                              )
                            }
                            className={`
                              h-9
                              w-full
                              min-w-[140px]
                              border-0
                              bg-transparent
                              px-2
                              outline-none

                              ${
                                official &&
                                !cellFormat.textColor
                                  ? "cursor-default font-medium text-emerald-950 dark:text-emerald-100"
                                  : "text-slate-800 dark:text-slate-200"
                              }
                            `}
                          />

                          {/* CANDADO */}

                          {official && (
                            <span className="pointer-events-none absolute right-1 top-1 text-[8px] opacity-40">
                              🔒
                            </span>
                          )}

                          {/* CONTROL DE ARRASTRE */}

                          {isMainCell &&
                            !official &&
                            selection &&
                            selection.start.row ===
                              selection.end.row &&
                            selection.start.col ===
                              selection.end.col && (
                              <div
                                onMouseDown={(
                                  event
                                ) =>
                                  beginFill(
                                    {
                                      row,
                                      col,
                                    },
                                    event
                                  )
                                }
                                title="Arrastrar fórmula"
                                className="absolute -bottom-1 -right-1 z-20 h-3 w-3 cursor-crosshair border border-white bg-blue-600"
                              />
                            )}
                        </td>
                      );
                    }
                  )}
                </tr>
              )
            )}

            {/* ESPACIADOR INFERIOR */}

            {bottomSpacerHeight >
              0 && (
              <tr>
                <td
                  colSpan={
                    TOTAL_COLS +
                    1
                  }
                  style={{
                    height:
                      bottomSpacerHeight,
                  }}
                  className="border-0 p-0"
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          BARRA INFERIOR
      ====================================================== */}

      <div className="shrink-0 flex min-h-10 flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white px-4 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-5 text-slate-600 dark:text-slate-300">
          {selectionStats && (
            <>
              <span>
                Selección:{" "}
                <strong>
                  {
                    selectionStats.selectedCount
                  }
                </strong>
              </span>

              <span>
                Números:{" "}
                <strong>
                  {
                    selectionStats.numericCount
                  }
                </strong>
              </span>

              {selectionStats.numericCount >
                0 && (
                <>
                  <span>
                    Suma:{" "}
                    <strong>
                      {formatNumber(
                        selectionStats.sum
                      )}
                    </strong>
                  </span>

                  <span>
                    Promedio:{" "}
                    <strong>
                      {formatNumber(
                        selectionStats.average
                      )}
                    </strong>
                  </span>

                  <span>
                    Mín:{" "}
                    <strong>
                      {selectionStats.min !==
                      null
                        ? formatNumber(
                            selectionStats.min
                          )
                        : "—"}
                    </strong>
                  </span>

                  <span>
                    Máx:{" "}
                    <strong>
                      {selectionStats.max !==
                      null
                        ? formatNumber(
                            selectionStats.max
                          )
                        : "—"}
                    </strong>
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <div className="text-slate-400">
          Ctrl+Z · Ctrl+Y · 300 filas · 40 columnas
        </div>
      </div>
    </main>
  );
}

// ===========================================================
// FECHA
// ===========================================================

function formatDate(
  value: string
) {
  if (!value) {
    return "";
  }

  const [
    year,
    month,
    day,
  ] = value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

// ===========================================================
// NÚMEROS
// ===========================================================

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      maximumFractionDigits: 6,
    }
  ).format(value);
}