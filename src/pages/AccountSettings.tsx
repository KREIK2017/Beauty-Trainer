import { useEffect, useState } from "react";
import type { SiteSettings } from "../../shared/admin";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { PageHeading } from "../components/ui";

export function PasswordSettings() {
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  return (
    <section className="detail-panel admin-settings">
      <h2>Змінити мій пароль</h2>
      <p>
        Після зміни попередні сесії буде завершено. У цьому браузері ви
        залишитеся в акаунті.
      </p>
      {passwordNotice && <p role="status">{passwordNotice}</p>}
      {passwordError && (
        <p className="error" role="alert">
          {passwordError}
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (passwordBusy) return;
          const form = event.currentTarget;
          const values = new FormData(form);
          setPasswordNotice("");
          setPasswordError("");
          if (values.get("newPassword") !== values.get("confirmation")) {
            setPasswordError("Нові паролі не збігаються.");
            return;
          }
          setPasswordBusy(true);
          try {
            await api("/auth/password", {
              method: "POST",
              body: JSON.stringify({
                currentPassword: values.get("currentPassword"),
                newPassword: values.get("newPassword"),
              }),
            });
            form.reset();
            setPasswordNotice("Пароль змінено. Попередні сесії завершено.");
            localStorage.setItem("beauty-auth-change", crypto.randomUUID());
          } catch (e) {
            setPasswordError((e as Error).message);
          } finally {
            setPasswordBusy(false);
          }
        }}
      >
        <fieldset disabled={passwordBusy}>
          <label>
            Поточний пароль
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Новий пароль
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <small>Від 12 до 128 символів.</small>
          <label>
            Повторіть новий пароль
            <input
              type="password"
              name="confirmation"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <button className="button primary">
            {passwordBusy ? "Змінюємо…" : "Змінити пароль"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
function RegistrationSettings() {
  const [data, setData] = useState<SiteSettings>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<SiteSettings>("/admin/settings")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason) => {
        if (active) setError((reason as Error).message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <section className="detail-panel admin-settings">
      <h2>Реєстрація учасників</h2>
      <p>
        Закриття реєстрації не впливає на вхід і прогрес наявних користувачів.
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
        >
          {error ? "Спробувати ще раз" : "Завантажуємо…"}
        </button>
      ) : (
        <form
          key={data.updatedAt}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const registrationOpen =
              new FormData(event.currentTarget).get("registrationOpen") ===
              "on";
            setBusy(true);
            setNotice("");
            setError("");
            try {
              await api("/admin/settings", {
                method: "PATCH",
                body: JSON.stringify({ registrationOpen }),
              });
              setNotice("Налаштування реєстрації збережено.");
              setRevision((value) => value + 1);
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="admin-check">
            <input
              type="checkbox"
              name="registrationOpen"
              defaultChecked={data.registrationOpen}
              disabled={busy}
            />
            Дозволити самостійну реєстрацію
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Зберігаємо…" : "Зберегти налаштування"}
          </button>
          <p className="small muted">
            Оновлено: {new Date(data.updatedAt).toLocaleString("uk-UA")}
          </p>
        </form>
      )}
    </section>
  );
}
export default function AccountSettings() {
  const { user } = useAuth();
  return (
    <>
      <PageHeading
        eyebrow="ОСОБИСТИЙ АКАУНТ"
        title="Налаштування"
        description={`Ваш логін: ${user.username}`}
      />
      {user.role === "admin" && <RegistrationSettings />}
      <PasswordSettings />
    </>
  );
}
