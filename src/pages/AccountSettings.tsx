import { useEffect, useState } from "react";
import {
  Check,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { SiteSettings } from "../../shared/admin";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { PageHeading } from "../components/ui";

export function PasswordSettings() {
  const { user, refreshAuth } = useAuth();
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  return (
    <section
      className="detail-panel admin-settings settings-section"
      id="security"
    >
      <div className="settings-section-heading">
        <span className="settings-section-icon" aria-hidden="true">
          <ShieldCheck size={21} />
        </span>
        <div>
          <h2>Безпека акаунта</h2>
          <p>Змініть пароль, якщо його могли побачити інші люди.</p>
        </div>
      </div>
      {user.mustChangePassword && (
        <p className="password-required" role="alert">
          Адміністратор надав вам тимчасовий пароль. Створіть новий пароль, щоб
          продовжити навчання.
        </p>
      )}
      {passwordNotice && (
        <p className="settings-notice" role="status">
          <Check size={18} aria-hidden="true" />
          {passwordNotice}
        </p>
      )}
      {passwordError && (
        <p className="error" role="alert">
          {passwordError}
        </p>
      )}
      <form
        className="settings-password-form"
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
            setNewPassword("");
            setConfirmation("");
            setPasswordNotice("Пароль змінено. Попередні сесії завершено.");
            localStorage.setItem("beauty-auth-change", crypto.randomUUID());
            refreshAuth();
          } catch (e) {
            setPasswordError((e as Error).message);
          } finally {
            setPasswordBusy(false);
          }
        }}
      >
        <fieldset disabled={passwordBusy}>
          <div className="settings-password-fields">
            <div>
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
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                Повторіть новий пароль
                <input
                  type="password"
                  name="confirmation"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            </div>
            <aside className="password-requirements" aria-live="polite">
              <strong>Вимоги до пароля</strong>
              <span className={newPassword.length >= 12 ? "complete" : ""}>
                <Check size={16} aria-hidden="true" />
                Від 12 до 128 символів
              </span>
              <span
                className={
                  confirmation && newPassword === confirmation
                    ? "complete"
                    : ""
                }
              >
                <Check size={16} aria-hidden="true" />
                Обидва нові паролі збігаються
              </span>
              <small>
                Після зміни інші сесії завершаться. У цьому браузері ви
                залишитеся в акаунті.
              </small>
            </aside>
          </div>
          <button className="button primary settings-submit">
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
    <section
      className="detail-panel admin-settings settings-section"
      id="registration"
    >
      <div className="settings-section-heading">
        <span className="settings-section-icon" aria-hidden="true">
          <UsersRound size={21} />
        </span>
        <div>
          <h2>Реєстрація учасників</h2>
          <p>
            Керуйте самостійною реєстрацією та корпоративним кодом запрошення.
          </p>
        </div>
      </div>
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
            const values = new FormData(event.currentTarget);
            const registrationOpen = values.get("registrationOpen") === "on";
            const invitationCode = String(
              values.get("invitationCode") ?? "",
            ).trim();
            const clearInvitationCode =
              values.get("clearInvitationCode") === "on";
            setBusy(true);
            setNotice("");
            setError("");
            try {
              await api("/admin/settings", {
                method: "PATCH",
                body: JSON.stringify({
                  registrationOpen,
                  invitationCode: invitationCode || undefined,
                  clearInvitationCode,
                }),
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
          <label>
            Новий корпоративний код запрошення
            <input
              type="password"
              name="invitationCode"
              minLength={8}
              maxLength={128}
              autoComplete="off"
              placeholder={
                data.invitationCodeConfigured
                  ? "Залиште порожнім, щоб не змінювати"
                  : "Щонайменше 8 символів"
              }
              disabled={busy}
            />
          </label>
          <p className="small muted">
            {data.invitationCodeConfigured
              ? "Код налаштовано. Він потрібен для створення нового акаунта."
              : "Код не налаштовано. За відкритої реєстрації зареєструватися може кожен."}
          </p>
          {data.invitationCodeConfigured && (
            <label className="admin-check">
              <input
                type="checkbox"
                name="clearInvitationCode"
                disabled={busy}
              />
              Видалити чинний код запрошення
            </label>
          )}
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

function AppearanceSettings() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("beauty-theme") === "dark",
  );
  function changeTheme(nextDark: boolean) {
    setDark(nextDark);
    localStorage.setItem("beauty-theme", nextDark ? "dark" : "light");
    window.dispatchEvent(new Event("beauty-theme-change"));
  }
  return (
    <section
      className="detail-panel admin-settings settings-section"
      id="appearance"
    >
      <div className="settings-section-heading">
        <span className="settings-section-icon" aria-hidden="true">
          <Monitor size={21} />
        </span>
        <div>
          <h2>Вигляд</h2>
          <p>Оберіть тему, з якою вам комфортніше навчатися.</p>
        </div>
      </div>
      <div className="theme-options" role="group" aria-label="Тема сайту">
        <button
          type="button"
          className={!dark ? "selected" : ""}
          aria-pressed={!dark}
          onClick={() => changeTheme(false)}
        >
          <Sun className="theme-option-icon" size={24} aria-hidden="true" />
          <strong>Світла</strong>
          <small>Світле робоче тло</small>
        </button>
        <button
          type="button"
          className={dark ? "selected" : ""}
          aria-pressed={dark}
          onClick={() => changeTheme(true)}
        >
          <Moon className="theme-option-icon" size={24} aria-hidden="true" />
          <strong>Темна</strong>
          <small>Менше яскравого світла</small>
        </button>
      </div>
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
      <div className="settings-layout">
        <aside className="settings-nav" aria-label="Розділи налаштувань">
          <a href="#profile">
            <UserRound size={19} />
            <span>
              <strong>Профіль</strong>
              <small>{user.username}</small>
            </span>
          </a>
          <a href="#security">
            <ShieldCheck size={19} />
            <span>
              <strong>Безпека</strong>
              <small>Пароль акаунта</small>
            </span>
          </a>
          <a href="#appearance">
            <Monitor size={19} />
            <span>
              <strong>Вигляд</strong>
              <small>Тема сайту</small>
            </span>
          </a>
          {user.role === "admin" && (
            <a href="#registration">
              <UsersRound size={19} />
              <span>
                <strong>Реєстрація</strong>
                <small>Тільки для власника</small>
              </span>
            </a>
          )}
        </aside>
        <div className="settings-content">
          <section className="settings-profile" id="profile">
            <span className="settings-avatar" aria-hidden="true">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <span>Ваш акаунт</span>
              <strong>{user.username}</strong>
              <small>
                {user.role === "admin" ? "Власник сайту" : "Учасник навчання"}
              </small>
            </div>
          </section>
          <PasswordSettings />
          <AppearanceSettings />
          {user.role === "admin" && <RegistrationSettings />}
        </div>
      </div>
    </>
  );
}
