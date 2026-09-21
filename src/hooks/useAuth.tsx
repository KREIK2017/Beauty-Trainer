import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { User } from "../../shared/auth";
import { api } from "../services/api";
import Welcome from "../pages/Welcome";

const Context = createContext<{
  user: User;
  logout: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<User | null>();
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ user: User | null; registrationOpen: boolean }>("/auth/me")
      .then((result) => {
        if (active) {
          setUser(result.user);
          setRegistrationOpen(result.registrationOpen);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
    };
    const changed = (event: StorageEvent) => {
      if (event.key === "beauty-auth-change") {
        setUser(undefined);
        setRevision((r) => r + 1);
      }
    };
    window.addEventListener("beauty-auth-expired", expired);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("beauty-auth-expired", expired);
      window.removeEventListener("storage", changed);
    };
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(undefined);
      setRevision((r) => r + 1);
      setError("");
      localStorage.setItem("beauty-auth-change", crypto.randomUUID());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (user === undefined)
    return (
      <div className="startup">
        <p role={error ? "alert" : "status"}>
          {error || "Відкриваємо ваш акаунт…"}
        </p>
        {error && (
          <button onClick={() => setRevision((r) => r + 1)}>
            Спробувати ще раз
          </button>
        )}
      </div>
    );
  if (location.pathname === "/welcome" || (!user && location.pathname === "/"))
    return <Welcome signedIn={!!user} registrationOpen={registrationOpen} />;
  if (user && ["/login", "/register", "/setup"].includes(location.pathname))
    return <Navigate to="/" replace />;
  if (!user)
    return (
      <AuthForm
        key={location.pathname}
        registrationOpen={registrationOpen}
        onSuccess={(value) => {
          setError("");
          setUser(value);
          localStorage.setItem("beauty-auth-change", crypto.randomUUID());
        }}
      />
    );
  return (
    <Context.Provider value={{ user, logout }}>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div key={user.id}>{children}</div>
    </Context.Provider>
  );
}
function AuthForm({
  onSuccess,
  registrationOpen,
}: {
  onSuccess: (user: User) => void;
  registrationOpen: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const setup = location.pathname === "/setup";
  const register = location.pathname === "/register";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = setup || register;
  if (register && !registrationOpen)
    return (
      <div className="auth-page">
        <section className="auth-card">
          <h1>Реєстрацію тимчасово закрито</h1>
          <p>Якщо ви вже маєте акаунт, можете увійти та продовжити навчання.</p>
          <Link className="button primary" to="/login">
            Увійти
          </Link>
          <Link className="back-link" to="/welcome">
            Про Beauty Trainer
          </Link>
        </section>
      </div>
    );
  return (
    <div className="auth-page">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const form = new FormData(event.currentTarget);
          if (creating && form.get("password") !== form.get("confirmation")) {
            setError("Паролі не збігаються.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await api<{ user: User }>(
              setup
                ? "/auth/setup"
                : register
                  ? "/auth/register"
                  : "/auth/login",
              {
                method: "POST",
                body: JSON.stringify({
                  username: form.get("username"),
                  password: form.get("password"),
                  setupKey: form.get("setupKey") || undefined,
                }),
              },
            );
            if (setup || location.pathname === "/login" || register)
              navigate("/", { replace: true });
            onSuccess(result.user);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">BEAUTY TRAINER</span>
        <h1>
          {setup
            ? "Створення акаунта власника"
            : register
              ? "Ваш навчальний простір"
              : "Раді бачити вас знову"}
        </h1>
        <p>
          {setup
            ? "Створіть свій акаунт. Попередній прогрес буде перенесено до нього."
            : "Увійдіть або зареєструйтеся, щоб зберігати власний прогрес навчання."}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <fieldset disabled={busy}>
          <label>
            Логін
            <input
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={40}
              pattern={"[A-Za-z0-9_\\-]{3,40}"}
              aria-describedby="username-hint"
            />
          </label>
          <small id="username-hint">
            3–40 латинських літер, цифр, дефісів або підкреслень.
          </small>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <small>Щонайменше 12 символів.</small>
          {creating && (
            <label>
              Повторіть пароль
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
          )}
          {setup && (
            <label>
              Ключ налаштування власника
              <input
                name="setupKey"
                type="password"
                autoComplete="off"
                required
              />
              <small>
                Приватний ключ OWNER_SETUP_KEY із налаштувань Worker.
              </small>
            </label>
          )}
          <button className="button primary" type="submit">
            {busy ? "Зачекайте…" : creating ? "Створити акаунт" : "Увійти"}
          </button>
        </fieldset>
        {!setup && registrationOpen && (
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => {
              navigate(register ? "/login" : "/register");
              setError("");
            }}
          >
            {register
              ? "Уже є акаунт? Увійти"
              : "Немає акаунта? Зареєструватися"}
          </button>
        )}
        <Link className="back-link" to="/welcome">
          Про Beauty Trainer
        </Link>
      </form>
    </div>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider required");
  return auth;
}
