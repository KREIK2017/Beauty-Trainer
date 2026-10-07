import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../hooks/useData";
import { Empty, PageHeading, Tags } from "../components/ui";
import type { Line, Product } from "../../shared/schema";
import type { FlashcardRating } from "../../shared/learning";
import { api } from "../services/api";

export default function Flashcards() {
  const { id } = useParams();
  const { catalog } = useData();
  const line = catalog.lines.find((item) => item.id === id);
  if (!line)
    return (
      <Empty title="Лінійку не знайдено">
        <Link to="/catalog">До каталогу</Link>
      </Empty>
    );
  const products = catalog.products.filter((p) => p.line_id === id);
  return <Deck key={id} line={line} products={products} />;
}

function Deck({ line, products }: { line: Line; products: Product[] }) {
  const { refresh } = useData();
  const [queue, setQueue] = useState(products.map((p) => p.id));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [repeat, setRepeat] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<FlashcardRating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product = products.find((p) => p.id === queue[index]);
  const finished = index >= queue.length;
  function restart(ids: string[]) {
    setQueue(ids);
    setIndex(0);
    setRepeat([]);
    setRatings({ again: 0, hard: 0, good: 0, easy: 0 });
    setRevealed(false);
  }
  async function rate(rating: FlashcardRating) {
    if (!revealed || !product || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/flashcards/rate", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, rating }),
      });
      if (rating === "again" || rating === "hard")
        setRepeat((ids) => [...ids, product.id]);
      setRatings((values) => ({ ...values, [rating]: values[rating] + 1 }));
      setIndex((value) => value + 1);
      setRevealed(false);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={`/lines/${line.id}`}>
        До лінійки {line.name}
      </Link>
      <PageHeading
        eyebrow="АКТИВНЕ ПРИГАДУВАННЯ"
        title={`Картки: ${line.name}`}
        description="Пригадайте призначення продукту, потім відкрийте відповідь і перевірте себе."
      />
      {!products.length ? (
        <Empty title="У цій лінійці ще немає продуктів" />
      ) : finished ? (
        <section
          className="detail-panel flashcards"
          aria-label="Підсумок карток"
        >
          <h2>Коло завершено</h2>
          <p>
            Не пам’ятаю: {ratings.again} · Важко: {ratings.hard} · Знаю:{" "}
            {ratings.good} · Легко: {ratings.easy}
          </p>
          <div className="actions">
            {repeat.length > 0 && (
              <button
                className="button primary"
                onClick={() => restart(repeat)}
              >
                Повторити складні картки
              </button>
            )}
            <button
              className="button secondary"
              onClick={() => restart(products.map((p) => p.id))}
            >
              Усі картки ще раз
            </button>
            <Link className="button primary" to={`/training?line=${line.id}`}>
              Пройти тест лінійки
            </Link>
          </div>
        </section>
      ) : product ? (
        <section
          className="detail-panel flashcards"
          aria-label="Навчальна картка"
        >
          <p className="muted" aria-live="polite">
            Картка {index + 1} із {queue.length}
          </p>
          <span className="eyebrow">{product.category}</span>
          <h2>{product.name}</h2>
          <p>Для чого цей продукт? Кому він підходить і які має переваги?</p>
          {!revealed ? (
            <button
              className="button primary"
              onClick={() => setRevealed(true)}
            >
              Відкрити відповідь
            </button>
          ) : (
            <>
              <div
                className="flashcard-answer"
                role="region"
                aria-label="Відповідь"
              >
                <h3>Призначення</h3>
                <p>{product.purpose}</p>
                <h3>Типи волосся</h3>
                <Tags values={product.hair_types} />
                <h3>Переваги</h3>
                <Tags values={product.benefits} />
                {product.usage && (
                  <>
                    <h3>Спосіб застосування</h3>
                    <p>{product.usage}</p>
                  </>
                )}
              </div>
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void rate("again")}
                >
                  Не пам’ятаю
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void rate("hard")}
                >
                  Важко
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void rate("good")}
                >
                  Знаю
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void rate("easy")}
                >
                  Легко
                </button>
              </div>
              {busy && <p role="status">Зберігаємо оцінку…</p>}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <Empty title="Продукт більше недоступний">
          <Link to={`/lines/${line.id}`}>До лінійки</Link>
        </Empty>
      )}
      <p className="quiz-note">
        Оцінка визначає, коли картка з’явиться для повторення. XP нараховується
        лише за перевірені відповіді у тестах.
      </p>
    </>
  );
}
