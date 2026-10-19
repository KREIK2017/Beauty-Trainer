import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  LockKeyhole,
  RotateCcw,
  Search,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { LineCard, PageHeading, ProgressBar } from "../components/ui";
import { lineLearningStatus, mastery } from "../../shared/learning";
import { counted } from "../../shared/uk";

export default function Dashboard() {
  const { catalog, stats } = useData();
  const productIds = (lineId: string) =>
    catalog.products
      .filter((product) => product.line_id === lineId)
      .map((product) => product.id);
  const lineActivity = (lineId: string) => {
    const ids = new Set(productIds(lineId));
    const progress = stats.progress.filter(
      (item) =>
        (item.entity_type === "line" && item.entity_id === lineId) ||
        (item.entity_type === "product" && ids.has(item.entity_id)),
    );
    const reviewed = new Set(
      stats.flashcardReviews
        .filter((review) => ids.has(review.product_id))
        .map((review) => review.product_id),
    ).size;
    const normalComplete = stats.lineTestCompletions.some(
      (completion) =>
        completion.line_id === lineId && completion.difficulty === "normal",
    );
    const hardComplete = stats.lineTestCompletions.some(
      (completion) =>
        completion.line_id === lineId && completion.difficulty === "hard",
    );
    return {
      progress,
      reviewed,
      normalComplete,
      hardComplete,
      productIds: [...ids],
    };
  };
  const statusPriority = { review: 0, learning: 1, new: 2, mastered: 3 };
  const suggestedLines = [...catalog.lines]
    .sort((a, b) => {
      const aIds = productIds(a.id);
      const bIds = productIds(b.id);
      return (
        statusPriority[lineLearningStatus(stats, a.id, aIds)] -
          statusPriority[lineLearningStatus(stats, b.id, bIds)] ||
        mastery(stats.progress, "line", a.id) -
          mastery(stats.progress, "line", b.id)
      );
    })
    .slice(0, 3);
  const activeLine = [...catalog.lines]
    .filter((line) => {
      const activity = lineActivity(line.id);
      return (
        (activity.progress.length > 0 ||
          activity.reviewed > 0 ||
          activity.normalComplete ||
          activity.hardComplete) &&
        lineLearningStatus(stats, line.id, activity.productIds) !== "mastered"
      );
    })
    .sort(
      (a, b) =>
        mastery(stats.progress, "line", a.id) -
        mastery(stats.progress, "line", b.id),
    )[0];
  const focusLine =
    activeLine ??
    catalog.lines.find((line) => {
      const activity = lineActivity(line.id);
      return (
        !activity.progress.length &&
        !activity.reviewed &&
        !activity.normalComplete &&
        !activity.hardComplete
      );
    }) ??
    catalog.lines[0];
  const focusActivity = focusLine ? lineActivity(focusLine.id) : undefined;
  const focusProducts = focusLine ? productIds(focusLine.id) : [];
  const cardsComplete =
    !!focusActivity &&
    focusProducts.length > 0 &&
    focusActivity.reviewed === focusProducts.length;
  const continueTo = !focusLine
    ? "/catalog"
    : !cardsComplete
      ? `/lines/${focusLine.id}/cards`
      : !focusActivity?.normalComplete
        ? `/training?line=${focusLine.id}`
        : `/training?line=${focusLine.id}&difficulty=hard`;
  const dueProducts = stats.progress
    .filter(
      (item) =>
        item.entity_type === "product" &&
        item.next_review_at <= new Date().toISOString(),
    )
    .sort((a, b) => a.mastery_score - b.mastery_score)
    .map((item) =>
      catalog.products.find((product) => product.id === item.entity_id),
    )
    .filter((product) => product !== undefined)
    .slice(0, 3);
  const focusImage =
    focusLine?.image ??
    catalog.products.find((product) => product.line_id === focusLine?.id)
      ?.image;

  return (
    <>
      <PageHeading
        eyebrow="РОБОЧИЙ ПРОСТІР"
        title="Продовжуйте навчання"
        description="Вивчайте продукцію та знаходьте потрібну інформацію під час роботи."
        action={
          <Link className="button secondary" to="/training?mode=daily">
            Тренування на сьогодні <ArrowRight size={16} />
          </Link>
        }
      />

      {focusLine ? (
        <section className="p1-learning-hero">
          <div className="p1-learning-summary">
            <div>
              <span className="eyebrow">ПРОДОВЖИТИ НАВЧАННЯ</span>
              <h2>{focusLine.name}</h2>
              <p>{focusLine.short_description}</p>
            </div>
            {focusImage && (
              <div className="p1-focus-image">
                <img src={focusImage} alt="" />
              </div>
            )}
            <div className="p1-focus-progress">
              <ProgressBar
                value={
                  focusProducts.length
                    ? Math.round(
                        ((focusActivity?.reviewed ?? 0) /
                          focusProducts.length) *
                          100,
                      )
                    : 0
                }
              />
              <span>
                {focusActivity?.reviewed ?? 0} з {focusProducts.length} карток
              </span>
            </div>
            <Link className="button light-button" to={continueTo}>
              Продовжити <ArrowRight size={18} />
            </Link>
          </div>
          <div className="p1-route" aria-label="Ваш навчальний маршрут">
            <h2>Ваш навчальний маршрут</h2>
            <RouteStep
              number={1}
              title="Картки"
              description="Вивчіть ключову інформацію про продукти."
              state={cardsComplete ? "complete" : "active"}
            />
            <RouteStep
              number={2}
              title="Звичайний тест"
              description="Перевірте базові знання лінійки."
              state={
                focusActivity?.normalComplete
                  ? "complete"
                  : cardsComplete
                    ? "active"
                    : "locked"
              }
            />
            <RouteStep
              number={3}
              title="Складний тест"
              description="Закріпіть знання у практичних форматах."
              state={
                focusActivity?.hardComplete
                  ? "complete"
                  : focusActivity?.normalComplete
                    ? "active"
                    : "locked"
              }
            />
          </div>
        </section>
      ) : null}

      <section className="p1-catalog-shortcut">
        <div>
          <BookOpen size={25} />
          <div>
            <h2>Каталог продуктів</h2>
            <p>Знайдіть продукт, лінійку або рішення для потреби клієнта.</p>
          </div>
        </div>
        <Link to="/catalog" className="p1-search-link">
          <Search size={19} />
          <span>Знайти продукт, лінійку або потребу</span>
          <ArrowRight size={18} />
        </Link>
        <div className="p1-brand-chips" aria-label="Бренди каталогу">
          {catalog.brands.slice(0, 6).map((brand) => (
            <Link key={brand.id} to={`/catalog?brand=${brand.id}`}>
              {brand.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <h2>Призначено вам</h2>
            <p>Лінійки, з яких варто продовжити навчання.</p>
          </div>
          <Link to="/catalog">
            Усі лінійки <ArrowRight size={15} />
          </Link>
        </div>
        <div className="line-grid p1-assigned-lines">
          {suggestedLines.map((line, index) => (
            <LineCard key={line.id} line={line} index={index} />
          ))}
        </div>
      </section>

      <section className="p1-review-strip">
        <div className="section-heading">
          <div>
            <h2>Повторити сьогодні</h2>
            <p>
              {dueProducts.length
                ? `${counted(dueProducts.length, ["продукт", "продукти", "продуктів"])} готові до короткого повторення.`
                : "На сьогодні запланованих повторень немає."}
            </p>
          </div>
          <Link to="/weak">
            Усі повторення <ArrowRight size={15} />
          </Link>
        </div>
        {dueProducts.length ? (
          <div className="p1-review-items">
            {dueProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <span className="p1-review-thumb">
                  {product.image ? (
                    <img src={product.image} alt="" />
                  ) : (
                    <RotateCcw size={20} />
                  )}
                </span>
                <span>
                  <small>
                    {
                      catalog.brands.find(
                        (brand) => brand.id === product.brand_id,
                      )?.name
                    }
                  </small>
                  <strong>{product.name}</strong>
                </span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p1-review-empty">
            <Check size={20} />
            <span>Можна продовжити нову лінійку або відкрити каталог.</span>
            <Link to="/catalog">До каталогу</Link>
          </div>
        )}
      </section>
    </>
  );
}

function RouteStep({
  number,
  title,
  description,
  state,
}: {
  number: number;
  title: string;
  description: string;
  state: "active" | "complete" | "locked";
}) {
  return (
    <div className={`p1-route-step ${state}`}>
      <span className="p1-route-number">
        {state === "complete" ? (
          <Check size={17} />
        ) : state === "locked" ? (
          <LockKeyhole size={16} />
        ) : (
          number
        )}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {state === "active" && <Clock3 size={17} />}
    </div>
  );
}
