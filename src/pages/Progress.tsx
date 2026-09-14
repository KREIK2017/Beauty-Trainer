import { Link } from "react-router-dom";
import { ArrowRight, Target, TrendingUp } from "lucide-react";
import { useData } from "../hooks/useData";
import { Empty, PageHeading, ProgressBar } from "../components/ui";
import type { EntityType } from "../../shared/schema";
import { counted, entityLabels, weakHeadings } from "../../shared/uk";
export function WeakAreas() {
  const { catalog, stats } = useData();
  const confused = new Map<string, number>();
  stats.history
    .filter(
      (h) =>
        !h.correct &&
        h.selected_answer !== h.correct_answer &&
        catalog.products.some((p) => p.name === h.selected_answer) &&
        catalog.products.some((p) => p.name === h.correct_answer),
    )
    .forEach((h) => {
      const key = [h.correct_answer, h.selected_answer].sort().join(" ↔ ");
      confused.set(key, (confused.get(key) ?? 0) + 1);
    });
  return (
    <>
      <PageHeading
        eyebrow="ПЕРЕТВОРЮЙТЕ ПРОГАЛИНИ НА СИЛЬНІ СТОРОНИ"
        title="Теми, що потребують уваги."
        description="До цих тем варто повернутися. Саме так знання стають міцнішими."
        action={
          <Link className="button primary" to="/training?mode=weak">
            Повторити слабкі теми
            <ArrowRight size={16} />
          </Link>
        }
      />
      <div className="weak-grid">
        {(["brand", "line", "product"] as EntityType[]).map((type) => {
          const rows = stats.progress
            .filter((p) => p.entity_type === type && p.mastery_score < 60)
            .sort((a, b) => a.mastery_score - b.mastery_score);
          return (
            <section className="detail-panel" key={type}>
              <div className="row">
                <h2>{weakHeadings[type]}</h2>
                <Target size={19} />
              </div>
              {rows.length ? (
                rows.map((p) => (
                  <div className="progress-row" key={p.entity_id}>
                    <div className="row">
                      <strong>
                        {(type === "brand"
                          ? catalog.brands
                          : type === "line"
                            ? catalog.lines
                            : catalog.products
                        ).find((x) => x.id === p.entity_id)?.name ??
                          "Видалена тема"}
                      </strong>
                      <span>{p.mastery_score}%</span>
                    </div>
                    <ProgressBar value={p.mastery_score} />
                    <small>
                      Помилково: {p.incorrect_answers} · Правильно:{" "}
                      {p.correct_answers}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Тем для повторення в цій категорії поки немає.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <section className="detail-panel">
        <h2>Продукти, які часто плутаються</h2>
        {confused.size ? (
          [...confused]
            .sort((a, b) => b[1] - a[1])
            .map(([pair, count]) => (
              <div className="confusion-row" key={pair}>
                <span>{pair}</span>
                <span className="tag">
                  {counted(count, ["плутанина", "плутанини", "плутанин"])}
                </span>
              </div>
            ))
        ) : (
          <p className="muted">
            Тут з’являться пари продуктів, коли ви оберете один замість іншого.
          </p>
        )}
      </section>
    </>
  );
}
export function ProgressPage() {
  const { catalog, stats } = useData();
  const attempts = stats.history.length;
  const accuracy = attempts
    ? Math.round(
        (stats.history.filter((h) => h.correct).length / attempts) * 100,
      )
    : 0;
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 13 + i);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      count: stats.history.filter((h) => h.created_at.startsWith(key)).length,
    };
  });
  return (
    <>
      <PageHeading
        eyebrow="ПОГЛЯНЬТЕ НА СВІЙ ШЛЯХ"
        title="Прогрес — запитання за запитанням."
        description="Кожне тренування додає знань. Продовжуйте практикуватися."
      />
      <div className="stats-grid">
        {[
          ["Усього XP", stats.xp],
          ["Точність", `${accuracy}%`],
          ["Надано відповідей", attempts],
          ["Поточна серія", counted(stats.streak, ["день", "дні", "днів"])],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="detail-panel">
        <div className="row">
          <h2>Останні 14 днів</h2>
          <TrendingUp size={20} />
        </div>
        <div className="activity-chart">
          {days.map((d) => (
            <div
              key={d.date}
              className="activity-day"
              title={`${d.date}: ${counted(d.count, ["відповідь", "відповіді", "відповідей"])}`}
            >
              <span>{d.count}</span>
              <div
                style={{
                  height: `${Math.max(5, (d.count / Math.max(10, ...days.map((x) => x.count))) * 100)}px`,
                }}
              />
              <small>{d.date.slice(8)}</small>
            </div>
          ))}
        </div>
        <p className="muted small">Відповіді за день · UTC</p>
      </section>
      <section className="detail-panel">
        <h2>Ваша карта знань</h2>
        {stats.progress.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Тема</th>
                  <th>Тип</th>
                  <th>Засвоєння</th>
                  <th>Правильно / помилково</th>
                  <th>Наступне повторення</th>
                </tr>
              </thead>
              <tbody>
                {stats.progress.map((p) => (
                  <tr key={p.entity_type + p.entity_id}>
                    <td>
                      {(p.entity_type === "brand"
                        ? catalog.brands
                        : p.entity_type === "line"
                          ? catalog.lines
                          : catalog.products
                      ).find((x) => x.id === p.entity_id)?.name ??
                        "Видалена тема"}
                    </td>
                    <td>{entityLabels[p.entity_type]}</td>
                    <td>
                      <div className="mastery-cell">
                        <ProgressBar value={p.mastery_score} />
                        <span>{p.mastery_score}%</span>
                      </div>
                    </td>
                    <td>
                      {p.correct_answers} / {p.incorrect_answers}
                    </td>
                    <td>
                      {p.next_review_at <= new Date().toISOString() ? (
                        <span className="tag">Час повторити</span>
                      ) : (
                        new Date(p.next_review_at).toLocaleString("uk-UA")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Ваше навчання починається тут">
            <Link className="button primary" to="/training">
              Почати тренування
            </Link>
          </Empty>
        )}
      </section>
    </>
  );
}
