import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import type { AdminAccounts, AdminAccountDetail } from "../../shared/admin";
import AccountAccess from "../components/AccountAccess";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { PageHeading, ProgressBar } from "../components/ui";

function useAdminResource<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError("");
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, reload: () => setRevision((r) => r + 1) };
}
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("uk-UA", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Ще немає даних";
function LoadState({ error, reload }: { error: string; reload: () => void }) {
  return error ? (
    <div className="error" role="alert">
      {error}{" "}
      <button className="button secondary" onClick={reload}>
        Спробувати ще раз
      </button>
    </div>
  ) : (
    <p role="status">Завантажуємо…</p>
  );
}
export function AdminLayout() {
  const { user } = useAuth();
  if (user.role !== "admin")
    return (
      <div className="empty">
        <h1>Керування доступне лише власнику</h1>
        <Link to="/catalog">До бібліотеки</Link>
      </div>
    );
  return (
    <>
      <nav className="admin-nav" aria-label="Розділи адміністратора">
        <NavLink to="/admin/users">Акаунти та прогрес</NavLink>
        <NavLink to="/admin" end>
          Матеріали
        </NavLink>
      </nav>
      <Outlet />
    </>
  );
}
export function AdminUsers() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAdminResource<AdminAccounts>(
    `/admin/users?search=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <PageHeading
        eyebrow="ПАНЕЛЬ АДМІНІСТРАТОРА"
        title="Акаунти та навчання"
        description="Переглядайте активність, результати та теми, які потребують повторення."
        action={
          <button className="button secondary" onClick={reload}>
            Оновити
          </button>
        }
      />
      {data && (
        <div className="admin-metrics">
          <div>
            <strong>{data.summary.accounts}</strong>
            <span>Усього акаунтів</span>
          </div>
          <div>
            <strong>{data.summary.activeLearners}</strong>
            <span>Відповідали в тестах за останні 7 днів</span>
          </div>
          <div>
            <strong>{data.summary.totalXp}</strong>
            <span>Загальний XP</span>
          </div>
        </div>
      )}
      <form
        className="admin-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <label>
          Пошук за логіном
          <input
            value={draft}
            maxLength={40}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Введіть логін"
          />
        </label>
        <button className="button primary">Знайти</button>
        {search && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft("");
              setSearch("");
              setPage(1);
            }}
          >
            Скинути пошук
          </button>
        )}
      </form>
      {!data ? (
        <LoadState error={error} reload={reload} />
      ) : (
        <>
          <p className="muted">
            Знайдено акаунтів: {data.total}. Дати показано за часовим поясом
            вашого пристрою.
          </p>
          <div className="admin-user-grid">
            {data.users.map((account) => (
              <article className="admin-user-card" key={account.id}>
                <h2>
                  <Link to={`/admin/users/${account.id}`}>
                    {account.username}
                  </Link>
                </h2>
                <p>{account.role === "admin" ? "Власник" : "Учасник"}</p>
                <dl>
                  <dt>XP</dt>
                  <dd>{account.xp}</dd>
                  <dt>Відповідей</dt>
                  <dd>{account.answers}</dd>
                  <dt>Правильних</dt>
                  <dd>
                    {account.answers
                      ? `${Math.round((account.correct_answers / account.answers) * 100)}%`
                      : "Ще немає відповідей"}
                  </dd>
                  <dt>Засвоєно продуктів</dt>
                  <dd>{account.mastered_products}</dd>
                  <dt>Продуктів для повторення</dt>
                  <dd>{account.weak_products}</dd>
                </dl>
                <p className="small">
                  Останній вхід: {date(account.last_login_at)}
                  <br />
                  Остання відповідь: {date(account.last_practice_at)}
                  <br />
                  Реєстрація: {date(account.created_at)}
                </p>
                <Link
                  className="button secondary"
                  to={`/admin/users/${account.id}`}
                  aria-label={`Переглянути прогрес ${account.username}`}
                >
                  Переглянути прогрес
                </Link>
              </article>
            ))}
          </div>
          {!data.users.length && <p>За цим логіном нікого не знайдено.</p>}
          <div className="admin-pagination">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Попередня
            </button>
            <span>
              Сторінка {page} із{" "}
              {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <button
              className="button secondary"
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Наступна
            </button>
          </div>
        </>
      )}
    </>
  );
}
export function AdminUserDetail() {
  const { id } = useParams();
  const { data, error, reload } = useAdminResource<AdminAccountDetail>(
    `/admin/users/${encodeURIComponent(id ?? "")}`,
  );
  const [kind, setKind] = useState("product");
  const [accessNotice, setAccessNotice] = useState("");
  if (!data)
    return (
      <>
        <Link to="/admin/users">До акаунтів</Link>
        <LoadState error={error} reload={reload} />
      </>
    );
  const { account } = data;
  const progress = data.progress.filter((p) => p.entity_type === kind);
  return (
    <>
      <Link className="back-link" to="/admin/users">
        До акаунтів
      </Link>
      <PageHeading
        eyebrow="ПРОГРЕС УЧАСНИКА"
        title={account.username}
        description={`Зареєстровано: ${date(account.created_at)}. Остання відповідь: ${date(account.last_practice_at)}.`}
        action={
          <button className="button secondary" onClick={reload}>
            Оновити
          </button>
        }
      />
      <div className="admin-metrics">
        <div>
          <strong>{account.xp}</strong>
          <span>XP</span>
        </div>
        <div>
          <strong>
            {account.correct_answers} / {account.answers}
          </strong>
          <span>Правильних відповідей</span>
        </div>
        <div>
          <strong>{account.sessions}</strong>
          <span>Тестів із хоча б однією відповіддю</span>
        </div>
      </div>
      {accessNotice && <p role="status">{accessNotice}</p>}
      <AccountAccess
        key={JSON.stringify(data.access)}
        account={account}
        initial={data.access}
        onSaved={() => {
          setAccessNotice("Доступ до навчання збережено.");
          reload();
        }}
      />
      <section className="detail-panel">
        <h2>Засвоєння матеріалів</h2>
        <p>
          Спочатку показано теми з нижчим рівнем засвоєння. Продукт засвоєний
          від 80%; вивчені теми нижче 60% потребують повторення.
        </p>
        <label className="admin-progress-filter">
          Показати
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="product">Продукти</option>
            <option value="line">Лінійки</option>
            <option value="brand">Бренди</option>
          </select>
        </label>
        {!progress.length && <p>Ці матеріали ще не вивчалися.</p>}
        <div className="admin-progress-list">
          {progress.map((p) => (
            <div key={`${p.entity_type}:${p.entity_id}`}>
              <div className="row">
                <strong>{p.name}</strong>
                <span>{p.mastery_score}%</span>
              </div>
              <ProgressBar value={p.mastery_score} />
              <small>
                Правильно: {p.correct_answers} · Помилки: {p.incorrect_answers}{" "}
                · Наступне повторення: {date(p.next_review_at)}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="detail-panel">
        <h2>Останні 20 відповідей</h2>
        {!data.recentAnswers.length && (
          <p>Користувач ще не відповідав у тестах.</p>
        )}
        <ul className="admin-history">
          {data.recentAnswers.map((answer) => (
            <li key={answer.id}>
              <strong>{answer.topic}</strong>
              <span>
                {answer.correct ? "Правильно" : "Потрібне повторення"} · +
                {answer.xp} XP · {date(answer.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
