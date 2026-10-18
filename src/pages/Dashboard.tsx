import { Link } from "react-router-dom";
import {
  ArrowRight,
  Flame,
  Zap,
  BookOpen,
  Layers,
  Clock3,
  Sparkles,
  Target,
  Check,
  Leaf,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { LineCard, PageHeading, ProgressBar } from "../components/ui";
import { learningStatus, mastery } from "../../shared/learning";
import { counted } from "../../shared/uk";
export default function Dashboard() {
  const { catalog, stats } = useData();
  const due = stats.progress.filter(
    (p) =>
      p.entity_type !== "brand" && p.next_review_at <= new Date().toISOString(),
  ).length;
  const weak = stats.progress
    .filter((p) => p.mastery_score < 60 && p.entity_type !== "brand")
    .sort((a, b) => a.mastery_score - b.mastery_score)
    .slice(0, 3);
  const learned = stats.progress.filter(
    (p) => p.entity_type === "product" && p.mastery_score >= 80,
  ).length;
  const today = stats.history.filter(
    (h) => h.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
  ).length;
  const statusPriority = { review: 0, learning: 1, new: 2, mastered: 3 };
  const suggestedLines = [...catalog.lines]
    .sort(
      (a, b) =>
        statusPriority[learningStatus(stats.progress, "line", a.id)] -
          statusPriority[learningStatus(stats.progress, "line", b.id)] ||
        mastery(stats.progress, "line", a.id) -
          mastery(stats.progress, "line", b.id),
    )
    .slice(0, 3);
  const lineActivity = (lineId: string) => {
    const productIds = new Set(
      catalog.products
        .filter((product) => product.line_id === lineId)
        .map((product) => product.id),
    );
    return stats.progress.filter(
      (item) =>
        (item.entity_type === "line" && item.entity_id === lineId) ||
        (item.entity_type === "product" && productIds.has(item.entity_id)),
    );
  };
  const activeLine = [...catalog.lines]
    .filter((line) => {
      const activity = lineActivity(line.id);
      return (
        activity.length > 0 &&
        learningStatus(stats.progress, "line", line.id) !== "mastered"
      );
    })
    .sort((a, b) => {
      const aScore = Math.max(
        0,
        ...lineActivity(a.id).map((item) => item.mastery_score),
      );
      const bScore = Math.max(
        0,
        ...lineActivity(b.id).map((item) => item.mastery_score),
      );
      return aScore - bScore;
    })[0];
  const newLine = catalog.lines.find(
    (line) => lineActivity(line.id).length === 0,
  );
  const nextStep = due
    ? {
        title: "Час повернутися до вивченого.",
        reason: `${counted(due, ["тема потребує", "теми потребують", "тем потребують"])} запланованого повторення. Почнемо з них, щоб знання не втрачалися.`,
        href: "/training?mode=daily",
        meta: "до 7 запитань · 3–5 хв",
      }
    : activeLine
      ? {
          title: `Закріпіть лінійку ${activeLine.name}.`,
          reason:
            "Ви вже почали цю тему. Короткий тест допоможе перевірити, що залишилося в пам’яті.",
          href: `/training?line=${activeLine.id}`,
          meta: "до 10 запитань · 5–7 хв",
        }
      : newLine
        ? {
            title: `Познайомтеся з ${newLine.name}.`,
            reason:
              "Це наступна нова лінійка у вашій бібліотеці. Спочатку перегляньте картки продуктів.",
            href: `/lines/${newLine.id}/cards`,
            meta: `${counted(
              catalog.products.filter(
                (product) => product.line_id === newLine.id,
              ).length,
              ["картка", "картки", "карток"],
            )} · у власному темпі`,
          }
        : {
            title: "Підтримуйте знання актуальними.",
            reason:
              "Усі доступні теми вже опрацьовані. Коротке тренування допоможе зберегти результат.",
            href: "/training?mode=daily",
            meta: "до 7 запитань · 3–5 хв",
          };
  const dailyGoal = 7;
  return (
    <>
      <PageHeading
        eyebrow="ТРОХИ ПРАКТИКИ — БІЛЬШЕ ВПЕВНЕНОСТІ"
        title="Ваша впевненість починається зі знань."
        description="Вивчайте продукти та перетворюйте знання на впевнені рекомендації."
        action={
          <span className="date-pill">
            {new Date().toLocaleDateString("uk-UA", {
              month: "short",
              day: "numeric",
              weekday: "short",
            })}
          </span>
        }
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-badge">
            <span />
            ВАША ЩОДЕННА ПОРЦІЯ ЗНАНЬ
          </span>
          <h2>{nextStep.title}</h2>
          <p>{nextStep.reason}</p>
          <div className="hero-buttons">
            <Link className="button light-button" to={nextStep.href}>
              Продовжити навчання <ArrowRight size={17} />
            </Link>
            <span>
              <Clock3 size={15} /> {nextStep.meta}
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-label">
            <Sparkles size={16} /> Щодня трохи більше знань
          </div>
          <div className="bottle bottle-tall">
            <div className="bottle-cap" />
            <span>milk_shake</span>
            <small>LIFESTYLING</small>
            <div className="bottle-rule" />
            <b>
              стиль.
              <br />
              захист.
              <br />
              блиск.
            </b>
            <small>ВАШ НОВИЙ КРОК</small>
          </div>
          <div className="bottle bottle-short">
            <div className="bottle-cap" />
            <span>INSIGHT</span>
            <small>DAILY USE</small>
            <Leaf size={30} />
            <b>
              щоденний
              <br />
              догляд.
            </b>
          </div>
          <div className="art-spark spark-one">✳</div>
          <div className="art-spark spark-two">✧</div>
        </div>
      </section>
      <section className="stats-grid">
        {[
          [Flame, "Серія навчання", `${stats.streak}`, "днів поспіль", "peach"],
          [
            Zap,
            "Усього XP",
            stats.xp.toLocaleString("uk-UA"),
            "здобуто у тренуваннях",
            "yellow",
          ],
          [
            BookOpen,
            "Засвоєні продукти",
            `${learned}`,
            `із ${catalog.products.length} у бібліотеці`,
            "green",
          ],
          [
            Layers,
            "Лінійки продуктів",
            `${catalog.lines.length}`,
            `брендів у бібліотеці: ${catalog.brands.length}`,
            "purple",
          ],
        ].map(([Icon, label, value, sub, tone]) => {
          const I = Icon as typeof Flame;
          return (
            <div className="stat-card" key={String(label)}>
              <div className="row">
                <span>{String(label)}</span>
                <div className={`stat-icon ${tone}`}>
                  <I size={18} />
                </div>
              </div>
              <strong>{String(value)}</strong>
              <small>{String(sub)}</small>
            </div>
          );
        })}
      </section>
      <div className="dashboard-columns">
        <div>
          <div className="section-heading">
            <div>
              <h2>Продовжуйте вивчення</h2>
              <p>Ще один крок до знання кожної лінійки.</p>
            </div>
            <Link to="/catalog">
              До каталогу <ArrowRight size={15} />
            </Link>
          </div>
          <div className="line-grid">
            {suggestedLines.map((l, i) => (
              <LineCard key={l.id} line={l} index={i} />
            ))}
          </div>
          <div className="learning-tip">
            <span className="tip-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>Запам’ятовуйте продукт і те, кому він підходить.</strong>
              <p>
                Клієнтські ситуації допомагають застосовувати знання в реальних
                розмовах.
              </p>
            </div>
            <Link to="/training" aria-label="Практикувати клієнтські ситуації">
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
        <aside className="review-panel">
          <div className="row">
            <h2>Фокус на сьогодні</h2>
            <span className="tag green-tag">РОЗВИВАЙМОСЯ</span>
          </div>
          <div className="review-count">
            <span className="stat-icon green">
              <Clock3 size={21} />
            </span>
            <div>
              <strong>
                {counted(due, ["тема", "теми", "тем"])} для повторення
              </strong>
              <p>
                {due
                  ? "Повторення допомагає запам’ятати."
                  : "Саме час дізнатися щось нове."}
              </p>
            </div>
          </div>
          <Link className="text-link" to="/training?mode=daily">
            Відкрити план на сьогодні <ArrowRight size={14} />
          </Link>
          <div className="panel-divider" />
          <div className="row">
            <h3>Теми, що потребують уваги</h3>
            <Target size={16} />
          </div>
          {weak.length ? (
            weak.map((p) => (
              <div className="weak-mini" key={p.entity_type + p.entity_id}>
                <div className="row">
                  <span>
                    {
                      (p.entity_type === "line"
                        ? catalog.lines
                        : catalog.products
                      ).find((x) => x.id === p.entity_id)?.name
                    }
                  </span>
                  <small>{p.mastery_score}%</small>
                </div>
                <ProgressBar value={p.mastery_score} />
              </div>
            ))
          ) : (
            <p className="muted small">
              Тут з’являтимуться теми для повторення. Кожна відповідь допомагає
              підібрати наступне тренування.
            </p>
          )}
          <Link className="text-link" to="/weak">
            Переглянути слабкі теми <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
      <section className="bottom-grid">
        <div className="daily-goal">
          <div className="row">
            <div>
              <span className="eyebrow">ФОРМУЙТЕ ЗВИЧКУ</span>
              <h3>Ваша щоденна ціль</h3>
            </div>
            <span className="goal-check">
              <Check size={19} />
            </span>
          </div>
          <div className="row small">
            <span>
              {Math.min(today, dailyGoal)} відповідей із {dailyGoal}
            </span>
            <strong>
              {Math.min(Math.round((today / dailyGoal) * 100), 100)}%
            </strong>
          </div>
          <ProgressBar
            value={Math.min(Math.round((today / dailyGoal) * 100), 100)}
          />
          <p>Кілька хвилин уваги сьогодні — відчутний результат завтра.</p>
        </div>
        <div className="library-overview">
          <div>
            <span className="eyebrow">ВАША БІБЛІОТЕКА ЗРОСТАЄ</span>
            <h3>
              {counted(catalog.brands.length, ["бренд", "бренди", "брендів"])}.
              Ще більше для вивчення.
            </h3>
            <p>Дізнайтеся, що робить кожен продукт особливим.</p>
            <Link className="text-link" to="/catalog">
              Відкрити каталог <ArrowRight size={14} />
            </Link>
          </div>
          <div className="brand-stack">
            {catalog.brands.slice(0, 2).map((b) => (
              <span key={b.id}>
                {b.name}
                <small>
                  {counted(
                    catalog.lines.filter((l) => l.brand_id === b.id).length,
                    ["лінійка", "лінійки", "лінійок"],
                  )}{" "}
                  ·{" "}
                  {Math.round(
                    catalog.lines
                      .filter((l) => l.brand_id === b.id)
                      .reduce(
                        (n, l) => n + mastery(stats.progress, "line", l.id),
                        0,
                      ) /
                      (catalog.lines.filter((l) => l.brand_id === b.id)
                        .length || 1),
                  )}
                  % засвоєно
                </small>
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
