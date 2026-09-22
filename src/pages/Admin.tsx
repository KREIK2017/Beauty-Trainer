import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus, Upload, Pencil, Trash2, X } from "lucide-react";
import { useData } from "../hooks/useData";
import { api } from "../services/api";
import { PageHeading } from "../components/ui";
import { Modal } from "../components/Modal";
import { fieldLabels, errorMessage } from "../../shared/uk";
import {
  catalogSchema,
  brandSchema,
  lineSchema,
  productSchema,
} from "../../shared/schema";
type Kind = "brands" | "lines" | "products";
const fields: Record<Kind, string[]> = {
  brands: ["id", "name", "description"],
  lines: [
    "id",
    "brand_id",
    "name",
    "short_description",
    "description",
    "hair_types",
    "purposes",
    "benefits",
    "keywords",
    "image",
  ],
  products: [
    "id",
    "brand_id",
    "line_id",
    "name",
    "category",
    "description",
    "hair_types",
    "purpose",
    "benefits",
    "ingredients",
    "image",
    "usage",
  ],
};
const arrays = [
  "hair_types",
  "purposes",
  "benefits",
  "keywords",
  "ingredients",
];
export default function Admin() {
  const { catalog, refresh } = useData();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<Kind>("products");
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] =
    useState<ReturnType<typeof catalogSchema.parse>>();
  const requestedProduct = params.get("edit");
  useEffect(() => {
    if (!requestedProduct) return;
    const product = catalog.products.find(
      (item) => item.id === requestedProduct,
    );
    setParams({}, { replace: true });
    if (!product) {
      setError("Продукт для редагування не знайдено.");
      return;
    }
    setKind("products");
    setEditing(true);
    setError("");
    setDraft(
      Object.fromEntries(
        Object.entries(product).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join("\n") : String(value ?? ""),
        ]),
      ),
    );
  }, [catalog.products, requestedProduct, setParams]);
  function edit(item?: object) {
    setEditing(!!item);
    setError("");
    setDraft(
      item
        ? Object.fromEntries(
            Object.entries(item).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join("\n") : String(v ?? ""),
            ]),
          )
        : {},
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const value = { ...draft } as Record<string, unknown>;
      for (const key of arrays)
        if (fields[kind].includes(key))
          value[key] = (draft[key] ?? "")
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean);
      for (const key of ["image", "usage"]) if (!value[key]) delete value[key];
      const parsed = {
        brands: brandSchema,
        lines: lineSchema,
        products: productSchema,
      }[kind].parse(value);
      await api(`/${kind}${editing ? `/${draft.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(parsed),
      });
      await refresh();
      setDraft(null);
      setNotice("Збережено в бібліотеці.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await api(`/${kind}/${pendingDelete.id}`, { method: "DELETE" });
      await refresh();
      setPendingDelete(null);
      setNotice("Видалено з бібліотеки.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function validate(raw: string) {
    setError("");
    setPreview(undefined);
    try {
      setPreview(catalogSchema.parse(JSON.parse(raw)));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function importData() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      await api("/import", { method: "POST", body: JSON.stringify(preview) });
      await refresh();
      setNotice(`Імпортовано продуктів: ${preview.products.length}.`);
      setPreview(undefined);
      setImportText("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(catalog, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "beauty-trainer-products.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        eyebrow="НАПОВНЮЙТЕ СВОЮ БІБЛІОТЕКУ"
        title="Керуйте навчальними матеріалами."
        description="Додавайте корисні матеріали та підтримуйте їхню точність і актуальність."
        action={
          <button className="button secondary" onClick={download}>
            <Download size={16} />
            Експортувати JSON
          </button>
        }
      />
      {error && !draft && !pendingDelete && (
        <pre className="error" role="alert">
          {error}
        </pre>
      )}
      {notice && (
        <div className="success notice" role="status">
          {notice}
        </div>
      )}
      <section className="detail-panel">
        <div className="section-heading">
          <div className="tabs">
            {(["brands", "lines", "products"] as Kind[]).map((k) => (
              <button
                className={kind === k ? "active" : ""}
                key={k}
                onClick={() => {
                  setKind(k);
                  setDraft(null);
                  setPendingDelete(null);
                }}
              >
                {fieldLabels[k]}
                <span>{catalog[k].length}</span>
              </button>
            ))}
          </div>
          <button className="button primary" onClick={() => edit()}>
            <Plus size={16} />
            Додати{" "}
            {kind === "brands"
              ? "бренд"
              : kind === "lines"
                ? "лінійку"
                : "продукт"}
          </button>
        </div>
        <div className="admin-list">
          {catalog[kind].map((item) => (
            <div className="admin-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.id}</small>
              </div>
              <div className="actions">
                <button
                  className="icon-button"
                  aria-label={`Редагувати ${item.name}`}
                  onClick={() => edit(item)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label={`Видалити ${item.name}`}
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {pendingDelete && (
        <Modal
          titleId="delete-title"
          onClose={() => setPendingDelete(null)}
          busy={busy}
        >
          <h2 id="delete-title">Видалити {pendingDelete.name}?</h2>
          {error && (
            <pre className="error" role="alert">
              {error}
            </pre>
          )}
          <p>
            {kind === "products"
              ? "Продукт і його прогрес засвоєння буде видалено."
              : "Пов’язані лінійки, продукти та їхній прогрес також буде видалено."}{" "}
            Історія результатів тренувань збережеться.
          </p>
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Видалити
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPendingDelete(null)}
            >
              Скасувати
            </button>
          </div>
        </Modal>
      )}
      {draft && (
        <Modal
          titleId="edit-title"
          onClose={() => setDraft(null)}
          busy={busy}
          large
        >
          <div className="row">
            <h2 id="edit-title">
              {editing ? "Редагувати" : "Додати"}{" "}
              {kind === "brands"
                ? "бренд"
                : kind === "lines"
                  ? "лінійку"
                  : "продукт"}
            </h2>
            <button
              className="icon-button"
              disabled={busy}
              onClick={() => setDraft(null)}
              aria-label="Закрити редактор"
            >
              <X size={20} />
            </button>
          </div>
          <p className="muted small">
            Кожне значення списку вводьте з нового рядка. ID може містити малі
            латинські літери, цифри й дефіси.
          </p>
          {error && (
            <pre className="error" role="alert">
              {error}
            </pre>
          )}
          <form
            noValidate
            onSubmit={(e) => void save(e)}
            className="admin-form"
          >
            {fields[kind].map((key) => (
              <label key={key}>
                <span>
                  {fieldLabels[key]}
                  {["image", "usage"].includes(key) ? " (необов’язково)" : ""}
                </span>
                {key === "brand_id" || key === "line_id" ? (
                  <select
                    aria-label={fieldLabels[key]}
                    required
                    value={draft[key] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [key]: e.target.value,
                        ...(key === "brand_id" ? { line_id: "" } : {}),
                      })
                    }
                  >
                    <option value="">
                      Оберіть {key === "brand_id" ? "бренд" : "лінійку"}
                    </option>
                    {(key === "brand_id"
                      ? catalog.brands
                      : catalog.lines.filter(
                          (l) => l.brand_id === draft.brand_id,
                        )
                    ).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                ) : arrays.includes(key) ||
                  key.includes("description") ||
                  key === "usage" ? (
                  <textarea
                    required={!["usage"].includes(key)}
                    value={draft[key] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                    rows={3}
                  />
                ) : (
                  <input
                    required={key !== "image"}
                    disabled={key === "id" && editing}
                    value={draft[key] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <div className="actions form-wide">
              <button className="button primary" disabled={busy} type="submit">
                {busy ? "Зберігаємо…" : "Зберегти зміни"}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Скасувати
              </button>
            </div>
          </form>
        </Modal>
      )}
      <section className="detail-panel import-panel">
        <div>
          <Upload size={24} />
          <h2>Імпортуйте свої продукти</h2>
          <p>
            Імпортуйте JSON-об’єкт із масивами <code>brands</code>,{" "}
            <code>lines</code>, та <code>products</code>. Записи з наявними ID
            оновлюються, з новими — додаються.
          </p>
          <p className="muted small">
            Експортуйте бібліотеку, щоб побачити приклад формату. Файл має
            містити відповідні бренди й лінійки. Максимальний розмір — 2 МБ.
          </p>
          <label className="file-label">
            Обрати JSON-файл
            <input
              type="file"
              className="sr-only"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) {
                  setError("Розмір файла перевищує 2 МБ");
                  return;
                }
                try {
                  const raw = await file.text();
                  setImportText(raw);
                  validate(raw);
                } catch {
                  setError("Не вдалося прочитати файл.");
                }
              }}
            />
          </label>
        </div>
        <div>
          <textarea
            className="json-input"
            aria-label="Дані JSON для імпорту"
            placeholder="Або вставте JSON сюди…"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setPreview(undefined);
            }}
            rows={8}
          />
          <button
            className="button secondary"
            disabled={!importText || busy}
            onClick={() => validate(importText)}
          >
            Перевірити JSON
          </button>
          {preview && (
            <div className="import-preview">
              <p>
                Готово: брендів — {preview.brands.length}, лінійок —{" "}
                {preview.lines.length}, продуктів — {preview.products.length}.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void importData()}
              >
                {busy ? "Імпортуємо…" : "Імпортувати перевірені дані"}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
