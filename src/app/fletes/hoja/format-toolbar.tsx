"use client";

import type { CellFormat } from "./types";

type Props = {
  currentFormat: CellFormat;
  disabled?: boolean;
  onChange: (changes: Partial<CellFormat>) => void;
  onClear: () => void;
};

const fonts = [
  "Arial",
  "Calibri",
  "Verdana",
  "Times New Roman",
  "Georgia",
  "Courier New",
];

export default function FormatToolbar({
  currentFormat,
  disabled = false,
  onChange,
  onClear,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      {/* FUENTE */}

      <select
        disabled={disabled}
        value={currentFormat.fontFamily ?? "Arial"}
        onChange={(event) =>
          onChange({
            fontFamily: event.target.value,
          })
        }
        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
      >
        {fonts.map((font) => (
          <option
            key={font}
            value={font}
          >
            {font}
          </option>
        ))}
      </select>

      {/* NEGRITA */}

      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange({
            bold: !currentFormat.bold,
          })
        }
        title="Negrita"
        className={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold transition disabled:opacity-40 ${
          currentFormat.bold
            ? "border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-950"
            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
        }`}
      >
        B
      </button>

      {/* COLOR DE TEXTO */}

      <label
        className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
        title="Color del texto"
      >
        <span className="font-bold">A</span>

        <input
          type="color"
          disabled={disabled}
          value={
            currentFormat.textColor ??
            "#000000"
          }
          onChange={(event) =>
            onChange({
              textColor: event.target.value,
            })
          }
          className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>

      {/* RELLENO */}

      <label
        className="flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
        title="Color de relleno"
      >
        <span>▣</span>

        <input
          type="color"
          disabled={disabled}
          value={
            currentFormat.backgroundColor ??
            "#ffffff"
          }
          onChange={(event) =>
            onChange({
              backgroundColor:
                event.target.value,
            })
          }
          className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>

      {/* QUITAR FORMATO */}

      <button
        type="button"
        disabled={disabled}
        onClick={onClear}
        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Quitar formato
      </button>
    </div>
  );
}