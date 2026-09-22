import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminAccount } from "../../shared/admin";
import type { LearningAccess } from "../../shared/access";
import { useData } from "../hooks/useData";
import { api } from "../services/api";

export default function AccountAccess({
  account,
  initial,
  onSaved,
}: {
  account: AdminAccount;
  initial: LearningAccess;
  onSaved: () => void;
}) {
  const { catalog } = useData();
  const navigate = useNavigate();
  const [access, setAccess] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const toggle = (key: "brandIds" | "lineIds", id: string, checked: boolean) =>
    setAccess((current) => ({
      ...current,
      [key]: checked
        ? [...current[key], id]
        : current[key].filter((value) => value !== id),
    }));
  if (account.role === "admin") return null;
  return (
    <>
      <section className="detail-panel account-access">
        <h2>Доступ до навчання</h2>
        <p>
          Дозвольте весь каталог або виберіть бренди й окремі лінійки. Вибраний
          бренд відкриває всі його лінійки, зокрема додані пізніше.
        </p>
        <p className="small muted">
          Прогрес зберігається. Після зміни доступу поточні тести завершуються;
          новий список матеріалів з’явиться після оновлення сторінки
          користувачем.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await api(`/admin/users/${account.id}/access`, {
                method: "PUT",
                body: JSON.stringify(access),
              });
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label className="access-check">
              <input
                type="checkbox"
                checked={access.allMaterials}
                onChange={(event) =>
                  setAccess({ ...access, allMaterials: event.target.checked })
                }
              />
              Дозволити весь каталог
            </label>
            {!access.allMaterials && (
              <div className="access-brands">
                {catalog.brands.map((brand) => (
                  <div className="access-brand" key={brand.id}>
                    <label className="access-check">
                      <input
                        type="checkbox"
                        checked={access.brandIds.includes(brand.id)}
                        onChange={(event) =>
                          toggle("brandIds", brand.id, event.target.checked)
                        }
                      />
                      Увесь бренд {brand.name}
                    </label>
                    <div className="access-lines">
                      {catalog.lines
                        .filter((line) => line.brand_id === brand.id)
                        .map((line) => (
                          <label className="access-check" key={line.id}>
                            <input
                              type="checkbox"
                              disabled={access.brandIds.includes(brand.id)}
                              checked={
                                access.brandIds.includes(brand.id) ||
                                access.lineIds.includes(line.id)
                              }
                              onChange={(event) =>
                                toggle("lineIds", line.id, event.target.checked)
                              }
                            />
                            {line.name}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!access.allMaterials &&
              !access.brandIds.length &&
              !access.lineIds.length && (
                <p>
                  Жоден матеріал не вибрано — навчання буде недоступне до
                  надання доступу.
                </p>
              )}
            <button className="button primary">
              {busy ? "Зберігаємо…" : "Зберегти доступ"}
            </button>
          </fieldset>
        </form>
      </section>
      <section className="detail-panel account-delete">
        <h2>Видалення акаунта</h2>
        <p>
          Акаунт, прогрес, XP та історія тестів будуть видалені назавжди.
          Відновлення недоступне.
        </p>
        <details>
          <summary>Видалити акаунт {account.username}</summary>
          {deleteError && (
            <p className="error" role="alert">
              {deleteError}
            </p>
          )}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || confirmation !== account.username) return;
              setBusy(true);
              setDeleteError("");
              try {
                await api(`/admin/users/${account.id}`, {
                  method: "DELETE",
                  body: JSON.stringify({ username: confirmation }),
                });
                navigate("/admin/users", { replace: true });
              } catch (e) {
                setDeleteError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Введіть логін для підтвердження: {account.username}
              <input
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={busy}
              />
            </label>
            <button
              className="button danger"
              disabled={busy || confirmation !== account.username}
            >
              {busy ? "Видаляємо…" : "Видалити назавжди"}
            </button>
          </form>
        </details>
      </section>
    </>
  );
}
