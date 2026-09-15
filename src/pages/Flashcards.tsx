import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../hooks/useData";
import { Empty, PageHeading, Tags } from "../components/ui";
import type { Line, Product } from "../../shared/schema";

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
  const [queue, setQueue] = useState(products.map((p) => p.id));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [repeat, setRepeat] = useState<string[]>([]);
  const product = products.find((p) => p.id === queue[index]);
  const finished = index >= queue.length;
  function restart(ids: string[]) {
    setQueue(ids);
    setIndex(0);
    setRepeat([]);
    setRevealed(false);
  }
  function rate(remembered: boolean) {
    if (!revealed || !product) return;
    if (!remembered) setRepeat((ids) => [...ids, product.id]);
    setIndex((value) => value + 1);
    setRevealed(false);
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
            Пам’ятаю: {queue.length - repeat.length} · Ще повторити:{" "}
            {repeat.length}
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
                  onClick={() => rate(false)}
                >
                  Ще повторити
                </button>
                <button className="button primary" onClick={() => rate(true)}>
                  Пам’ятаю
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <Empty title="Продукт більше недоступний">
          <Link to={`/lines/${line.id}`}>До лінійки</Link>
        </Empty>
      )}
      <p className="quiz-note">
        Позначки діють у цьому перегляді карток. XP та прогрес засвоєння
        оновлюються після відповідей у тесті.
      </p>
    </>
  );
}
