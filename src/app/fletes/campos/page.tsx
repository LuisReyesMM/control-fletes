"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";

type MainColumn = {
  id: string;
  column_key: string;
  label: string;
  visible: boolean;
  sort_order: number;
};

type CustomField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean";
  visible: boolean;
  required: boolean;
  sort_order: number;
};

export default function CamposPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mainColumns, setMainColumns] = useState<MainColumn[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] =
    useState<CustomField["field_type"]>("text");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Columna pendiente de confirmar
  const [columnToSave, setColumnToSave] =
    useState<MainColumn | null>(null);

  // =========================================================
  // TOAST: 3 SEGUNDOS
  // =========================================================

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  // =========================================================
  // CARGAR DATOS
  // =========================================================

  const loadData = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !profile.active ||
      profile.role !== "superuser"
    ) {
      router.replace("/fletes");
      return;
    }

    // Columnas principales

    const {
      data: mainColumnsData,
      error: mainColumnsError,
    } = await supabase
      .from("freight_column_settings")
      .select(
        `
        id,
        column_key,
        label,
        visible,
        sort_order
        `
      )
      .order("sort_order", {
        ascending: true,
      });

    if (mainColumnsError) {
      setErrorMessage(
        `No se pudieron cargar las columnas principales: ${mainColumnsError.message}`
      );

      setLoading(false);
      return;
    }

    // Campos personalizados

    const {
      data: customFieldsData,
      error: customFieldsError,
    } = await supabase
      .from("freight_custom_fields")
      .select(
        `
        id,
        field_key,
        label,
        field_type,
        visible,
        required,
        sort_order
        `
      )
      .order("sort_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (customFieldsError) {
      setErrorMessage(
        `No se pudieron cargar los campos personalizados: ${customFieldsError.message}`
      );

      setLoading(false);
      return;
    }

    setMainColumns((mainColumnsData ?? []) as MainColumn[]);
    setCustomFields((customFieldsData ?? []) as CustomField[]);

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    // Carga inicial de datos remotos; la función actualiza el estado al resolver.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // =========================================================
  // CAMBIAR NOMBRE LOCALMENTE
  // =========================================================

  function changeMainLabel(id: string, value: string) {
    setMainColumns((current) =>
      current.map((column) =>
        column.id === id
          ? {
              ...column,
              label: value,
            }
          : column
      )
    );
  }

  // =========================================================
  // GUARDAR COLUMNA PRINCIPAL
  // =========================================================

  async function saveMainColumn(column: MainColumn) {
    const cleanLabel = column.label.trim();

    if (!cleanLabel) {
      setErrorMessage("El nombre visible no puede quedar vacío.");
      return;
    }

    setSavingId(column.id);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("freight_column_settings")
      .update({
        label: cleanLabel,
      })
      .eq("id", column.id)
      .select(
        `
        id,
        column_key,
        label,
        visible,
        sort_order
        `
      )
      .single();

    if (error) {
      setErrorMessage(
        `No se pudo actualizar la columna: ${error.message}`
      );

      setSavingId(null);
      return;
    }

    if (!data) {
      setErrorMessage(
        "Supabase no confirmó la modificación. Revisa los permisos RLS."
      );

      setSavingId(null);
      return;
    }

    setMainColumns((current) =>
      current.map((item) =>
        item.id === data.id
          ? {
              ...item,
              label: data.label,
              visible: data.visible,
              sort_order: data.sort_order,
            }
          : item
      )
    );

    setSuccessMessage(
      `La columna ahora se llama "${data.label}".`
    );

    setSavingId(null);
  }

  // =========================================================
  // CONFIRMAR GUARDADO DE ENCABEZADO
  // =========================================================

  async function confirmSaveMainColumn() {
    if (!columnToSave) {
      return;
    }

    const column = columnToSave;

    setColumnToSave(null);

    await saveMainColumn(column);
  }

  // =========================================================
  // CANCELAR CAMBIO DE ENCABEZADO
  // =========================================================

  async function cancelSaveMainColumn() {
    setColumnToSave(null);

    // Recupera el valor real almacenado en Supabase
    await loadData();
  }

  // =========================================================
  // MOSTRAR / OCULTAR COLUMNA PRINCIPAL
  // =========================================================

  async function toggleMainColumn(column: MainColumn) {
    setErrorMessage("");

    const nextValue = !column.visible;

    const { data, error } = await supabase
      .from("freight_column_settings")
      .update({
        visible: nextValue,
      })
      .eq("id", column.id)
      .select("id, visible")
      .single();

    if (error || !data) {
      setErrorMessage(
        `No se pudo cambiar la visibilidad: ${
          error?.message ?? "Supabase no confirmó el cambio."
        }`
      );

      return;
    }

    setSuccessMessage(
      nextValue
        ? `"${column.label}" ahora está visible.`
        : `"${column.label}" fue ocultada.`
    );

    await loadData();
  }

  // =========================================================
  // REORDENAR COLUMNA PRINCIPAL
  // =========================================================

  async function moveMainColumn(
    index: number,
    direction: "up" | "down"
  ) {
    const otherIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      otherIndex < 0 ||
      otherIndex >= mainColumns.length
    ) {
      return;
    }

    const currentColumn = mainColumns[index];
    const otherColumn = mainColumns[otherIndex];

    const currentOrder = currentColumn.sort_order;
    const otherOrder = otherColumn.sort_order;

    setErrorMessage("");

    const { error: currentError } = await supabase
      .from("freight_column_settings")
      .update({
        sort_order: otherOrder,
      })
      .eq("id", currentColumn.id);

    if (currentError) {
      setErrorMessage(
        `No se pudo reordenar: ${currentError.message}`
      );

      return;
    }

    const { error: otherError } = await supabase
      .from("freight_column_settings")
      .update({
        sort_order: currentOrder,
      })
      .eq("id", otherColumn.id);

    if (otherError) {
      // Revertimos el primer cambio
      await supabase
        .from("freight_column_settings")
        .update({
          sort_order: currentOrder,
        })
        .eq("id", currentColumn.id);

      setErrorMessage(
        `No se pudo completar el reordenamiento: ${otherError.message}`
      );

      return;
    }

    setSuccessMessage(
      "El orden de las columnas fue actualizado."
    );

    await loadData();
  }

  // =========================================================
  // CREAR CLAVE PARA CAMPO PERSONALIZADO
  // =========================================================

  function createKey(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  // =========================================================
  // CREAR CAMPO PERSONALIZADO
  // =========================================================

  async function createCustomField(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    const cleanLabel = newLabel.trim();

    if (!cleanLabel) {
      setErrorMessage(
        "Escribe un nombre para el nuevo campo."
      );
      return;
    }

    const fieldKey = createKey(cleanLabel);

    if (!fieldKey) {
      setErrorMessage(
        "No se pudo generar una clave válida para el campo."
      );
      return;
    }

    const keyAlreadyExists = customFields.some(
      (field) => field.field_key === fieldKey
    );

    if (keyAlreadyExists) {
      setErrorMessage(
        `Ya existe un campo con la clave "${fieldKey}".`
      );
      return;
    }

    const highestOrder =
      customFields.length > 0
        ? Math.max(
            ...customFields.map(
              (field) => field.sort_order
            )
          )
        : 0;

    const { error } = await supabase
      .from("freight_custom_fields")
      .insert({
        field_key: fieldKey,
        label: cleanLabel,
        field_type: newType,
        visible: true,
        required: false,
        sort_order: highestOrder + 1,
      });

    if (error) {
      setErrorMessage(
        `No se pudo crear el campo: ${error.message}`
      );
      return;
    }

    setNewLabel("");
    setNewType("text");

    setSuccessMessage(
      `El campo "${cleanLabel}" fue creado.`
    );

    await loadData();
  }

  // =========================================================
  // MOSTRAR / OCULTAR CAMPO PERSONALIZADO
  // =========================================================

  async function toggleCustomField(field: CustomField) {
    setErrorMessage("");

    const nextValue = !field.visible;

    const { error } = await supabase
      .from("freight_custom_fields")
      .update({
        visible: nextValue,
      })
      .eq("id", field.id);

    if (error) {
      setErrorMessage(
        `No se pudo modificar el campo: ${error.message}`
      );
      return;
    }

    setSuccessMessage(
      nextValue
        ? `"${field.label}" ahora está visible.`
        : `"${field.label}" fue ocultado.`
    );

    await loadData();
  }

  // =========================================================
  // OBLIGATORIO / OPCIONAL
  // =========================================================

  async function toggleRequired(field: CustomField) {
    setErrorMessage("");

    const nextValue = !field.required;

    const { error } = await supabase
      .from("freight_custom_fields")
      .update({
        required: nextValue,
      })
      .eq("id", field.id);

    if (error) {
      setErrorMessage(
        `No se pudo modificar el campo: ${error.message}`
      );
      return;
    }

    setSuccessMessage(
      nextValue
        ? `"${field.label}" ahora es obligatorio.`
        : `"${field.label}" ahora es opcional.`
    );

    await loadData();
  }

  // =========================================================
  // ELIMINAR CAMPO PERSONALIZADO
  // =========================================================

  async function deleteCustomField(field: CustomField) {
    const confirmed = window.confirm(
      `¿Eliminar el campo "${field.label}"?\n\n` +
        "El campo dejará de mostrarse. Los datos históricos guardados en custom_fields no se eliminarán automáticamente."
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("freight_custom_fields")
      .delete()
      .eq("id", field.id);

    if (error) {
      setErrorMessage(
        `No se pudo eliminar el campo: ${error.message}`
      );
      return;
    }

    setSuccessMessage(
      `El campo "${field.label}" fue eliminado.`
    );

    await loadData();
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />

          <p className="text-slate-600 dark:text-slate-300">
            Cargando configuración...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      {/* =====================================================
          MODAL DE CONFIRMACIÓN
      ====================================================== */}

      {columnToSave && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[3px]">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white px-8 py-9 text-center shadow-[0_30px_100px_rgba(0,0,0,0.25)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl font-bold text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              !
            </div>

            <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
              ¿Guardar este cambio?
            </h2>

            <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
              El encabezado cambiará a:
            </p>

            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
              “{columnToSave.label}”
            </p>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={cancelSaveMainColumn}
                className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={savingId === columnToSave.id}
                onClick={confirmSaveMainColumn}
                className="rounded-xl bg-slate-900 px-7 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          TOAST MODERNO
      ====================================================== */}

      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[3px]">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.25)] dark:border-emerald-900 dark:bg-slate-900">
            <div className="absolute left-0 top-0 h-2 w-full bg-emerald-100 dark:bg-emerald-950">
              <div className="h-full animate-[toastProgress_3s_linear_forwards] bg-emerald-500" />
            </div>

            <div className="flex flex-col items-center px-8 py-12 text-center sm:px-12">
              <div className="relative mb-7">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />

                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-5xl font-bold text-white shadow-xl shadow-emerald-500/30">
                  ✓
                </div>
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Cambios guardados
              </h2>

              <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
                {successMessage}
              </p>

              <div className="mt-7 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Actualizando configuración...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/fletes")}
              className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ← Volver a fletes
            </button>

            <h1 className="mt-1 text-2xl font-bold">
              Configuración de campos
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Administración exclusiva para superusuarios
            </p>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* =====================================================
          CONTENIDO
      ====================================================== */}

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {/* =================================================
            COLUMNAS PRINCIPALES
        ================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <h2 className="text-xl font-bold">
              Columnas principales
            </h2>

            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Puedes cambiar el nombre visible, ocultar columnas,
              mostrarlas nuevamente y modificar su orden.
            </p>
          </div>

          {mainColumns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No se encontraron columnas principales.
            </div>
          ) : (
            <div className="space-y-3">
              {mainColumns.map((column, index) => (
                <div
                  key={column.id}
                  className={`grid gap-4 rounded-xl border p-4 transition lg:grid-cols-[220px_minmax(250px,1fr)_auto] ${
                    column.visible
                      ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                      : "border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div className="flex flex-col justify-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Campo interno
                    </p>

                    <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">
                      {column.column_key}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {column.visible ? "Visible" : "Oculto"}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Nombre visible
                    </label>

                    <input
                      type="text"
                      value={column.label}
                      onChange={(event) =>
                        changeMainLabel(
                          column.id,
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-slate-700"
                    />
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setColumnToSave(column)}
                      disabled={savingId === column.id}
                      className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {savingId === column.id
                        ? "Guardando..."
                        : "Guardar"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleMainColumn(column)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {column.visible
                        ? "👁 Ocultar"
                        : "👁 Mostrar"}
                    </button>

                    <button
                      type="button"
                      title="Mover hacia arriba"
                      disabled={index === 0}
                      onClick={() =>
                        moveMainColumn(index, "up")
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      title="Mover hacia abajo"
                      disabled={
                        index === mainColumns.length - 1
                      }
                      onClick={() =>
                        moveMainColumn(index, "down")
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =================================================
            CREAR CAMPO PERSONALIZADO
        ================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">
            Agregar campo personalizado
          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Los nuevos campos podrán aparecer en la tabla y en los
            formularios de captura.
          </p>

          <form
            onSubmit={createCustomField}
            className="mt-6 grid gap-4 md:grid-cols-[minmax(250px,1fr)_250px_auto]"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nombre del campo
              </label>

              <input
                type="text"
                value={newLabel}
                onChange={(event) =>
                  setNewLabel(event.target.value)
                }
                placeholder="Ej. Operador"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-slate-700"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tipo de campo
              </label>

              <select
                value={newType}
                onChange={(event) =>
                  setNewType(
                    event.target
                      .value as CustomField["field_type"]
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-slate-700"
              >
                <option value="text">
                  Texto
                </option>

                <option value="number">
                  Número
                </option>

                <option value="date">
                  Fecha
                </option>

                <option value="boolean">
                  Sí / No
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="self-end rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              + Crear campo
            </button>
          </form>
        </div>

        {/* =================================================
            CAMPOS PERSONALIZADOS
        ================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">
            Campos personalizados
          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Puedes ocultarlos, hacerlos obligatorios o eliminarlos.
          </p>

          {customFields.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Todavía no hay campos personalizados.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {customFields.map((field) => (
                <div
                  key={field.id}
                  className={`flex flex-col gap-4 rounded-xl border p-4 transition md:flex-row md:items-center md:justify-between ${
                    field.visible
                      ? "border-slate-200 dark:border-slate-700"
                      : "border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div>
                    <p className="font-semibold">
                      {field.label}
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Clave:{" "}
                      <span className="font-mono">
                        {field.field_key}
                      </span>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {field.field_type}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {field.visible
                          ? "Visible"
                          : "Oculto"}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {field.required
                          ? "Obligatorio"
                          : "Opcional"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleCustomField(field)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {field.visible
                        ? "👁 Ocultar"
                        : "👁 Mostrar"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleRequired(field)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {field.required
                        ? "✓ Obligatorio"
                        : "Opcional"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteCustomField(field)
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}