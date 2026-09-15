import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  Check,
  CircleX,
  Heart,
  Trophy,
  Zap,
} from "lucide-react";
import { SESSION_LIVES } from "../../shared/learning";
import { api } from "../services/api";
import { useData } from "../hooks/useData";
import { Empty, PageHeading, ProgressBar } from "../components/ui";
interface Session {
  id: string;
  questions: { id: string; type: string; prompt: string; options: string[] }[];
}
interface Feedback {
  correct: boolean;
  xp: number;
  answer: string;
  explanation: string;
  productId?: string;
  lineId: string;
}
export default function Training() {
  const [params] = useSearchParams();
  const { catalog, refresh } = useData();
  const lineId = params.get("line");
  const line = catalog.lines.find((l) => l.id === lineId);
  const [session, setSession] = useState<Session>();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Feedback[]>([]);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<Feedback>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const lives = Math.max(
    0,
    SESSION_LIVES - answers.filter((a) => !a.correct).length,
  );
  async function start() {
    setBusy(true);
    setError("");
    try {
      const s = await api<Session>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          mode: params.get("mode") === "weak" ? "weak" : "all",
          lineId: lineId ?? undefined,
        }),
      });
      setSession(s);
      setIndex(0);
      setAnswers([]);
      setFeedback(undefined);
      setSelected("");
      setFinished(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function answer(option: string) {
    if (!session || busy || feedback || lives === 0 || finished) return;
    setBusy(true);
    setSelected(option);
    setError("");
    try {
      const f = await api<Feedback>(`/sessions/${session.id}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: session.questions[index].id,
          answer: option,
        }),
      });
      setFeedback(f);
      setAnswers([...answers, f]);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setSelected("");
    } finally {
      setBusy(false);
    }
  }
  const topic = (f: Feedback) =>
    catalog.products.find((p) => p.id === f.productId)?.name ??
    catalog.lines.find((l) => l.id === f.lineId)?.name ??
    "Оновлена тема";
  const strong = [
    ...new Set(
      answers
        .filter(
          (a) =>
            a.correct &&
            !answers.some((b) => !b.correct && topic(a) === topic(b)),
        )
        .map(topic),
    ),
  ];
  const weak = [...new Set(answers.filter((a) => !a.correct).map(topic))];
  if (lineId && !line)
    return (
      <Empty title="Лінійку не знайдено">
        <Link to="/catalog">До каталогу</Link>
      </Empty>
    );
  return (
    <>
      {line && (
        <Link className="back-link" to={`/lines/${line.id}`}>
          До лінійки {line.name}
        </Link>
      )}
      <PageHeading
        eyebrow="ПРАКТИКА ЗАКРІПЛЮЄ ЗНАННЯ"
        title={
          line
            ? `Тест лінійки ${line.name}`
            : params.get("mode") === "weak"
              ? "Приділіть увагу слабким темам."
              : "Кожне тренування — крок уперед."
        }
        description="Спочатку пригадайте. Прочитайте пояснення. Закріпіть знання."
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!session ? (
        <div className="training-intro">
          <span className="intro-icon">
            <Brain size={44} strokeWidth={1.3} />
          </span>
          <span className="eyebrow">ВАШЕ ПЕРСОНАЛЬНЕ ТРЕНУВАННЯ</span>
          <h2>Від «здається» до «я знаю».</h2>
          <p>
            Пригадуйте властивості продуктів, визначайте потреби волосся та
            давайте рекомендації клієнтам. Спочатку — повторення і слабкі теми.
          </p>
          <div className="session-facts">
            <span>До 10 запитань</span>
            <span>
              {line
                ? "Лише обрана лінійка · до 5 типів запитань"
                : "7 типів запитань"}
            </span>
            <span>10 XP за правильну відповідь</span>
          </div>
          <p>
            У вас {SESSION_LIVES} життя. Кожна помилка забирає одне. Щоб скласти
            тест, дайте відповідь на всі запитання, зберігши хоча б одне життя.
          </p>
          {line && (
            <p>
              Порівнюйте продукти цієї серії. У невеликих лінійках тест буде
              коротшим: запитання без різних варіантів відповідей пропускаються.
            </p>
          )}
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void start()}
          >
            {busy ? "Готуємо…" : "Розпочати навчання"}
            <ArrowRight size={17} />
          </button>
        </div>
      ) : !session.questions.length ? (
        <Empty title="Поки немає запитань">
          <p>
            {params.get("mode") === "weak"
              ? "Спершу пройдіть звичайне тренування, щоб визначити теми для повторення."
              : "Додайте більше різних продуктів і лінійок, щоб сформувати варіанти відповідей."}
          </p>
          <Link
            className="button primary"
            to={params.get("mode") === "weak" ? "/training" : "/admin"}
            onClick={() => setSession(undefined)}
          >
            {params.get("mode") === "weak"
              ? "Звичайне тренування"
              : "Керування продуктами"}
          </Link>
        </Empty>
      ) : finished ? (
        <div className="session-summary">
          {lives > 0 ? (
            <Trophy size={48} className="gold" />
          ) : (
            <CircleX size={48} />
          )}
          <span className="eyebrow">ТРЕНУВАННЯ ЗАВЕРШЕНО</span>
          <h2>
            {lives > 0
              ? "Тест складено!"
              : "Життя закінчилися — тест не складено"}
          </h2>
          <p>
            {lives > 0
              ? "Ви дійшли до кінця та зберегли життя."
              : "Перегляньте помилки й спробуйте знову. Уже здобуті XP та прогрес збережено."}
          </p>
          <p>
            Відповідей: {answers.length} із {session.questions.length}. Життя:{" "}
            {lives} із {SESSION_LIVES}.
          </p>
          <div className="summary-stats">
            <div>
              <strong>
                {answers.filter((a) => a.correct).length} / {answers.length}
              </strong>
              <span>Правильні відповіді</span>
            </div>
            <div>
              <strong>+{answers.reduce((n, a) => n + a.xp, 0)}</strong>
              <span>Здобуто XP</span>
            </div>
          </div>
          <div className="detail-grid">
            <section>
              <h3>Сильні теми</h3>
              {strong.length ? (
                strong.map((t) => <p key={t}>✓ {t}</p>)
              ) : (
                <p>Продовжуйте: знання закріплюються з практикою.</p>
              )}
            </section>
            <section>
              <h3>Слабкі теми</h3>
              {weak.length ? (
                weak.map((t) => <p key={t}>{t}</p>)
              ) : (
                <p>Усе правильно. Чудова робота!</p>
              )}
            </section>
          </div>
          <section>
            <h3>Продукти для повторення</h3>
            {[
              ...new Set(
                answers
                  .filter((a) => !a.correct && a.productId)
                  .map((a) => a.productId!),
              ),
            ].map((id) => (
              <Link className="review-link" key={id} to={`/products/${id}`}>
                {catalog.products.find((p) => p.id === id)?.name}
                <ArrowRight size={14} />
              </Link>
            ))}
            {!answers.some((a) => !a.correct && a.productId) && (
              <p>
                За результатами цього тренування повторення продуктів не
                потрібне.
              </p>
            )}
          </section>
          <div className="actions">
            {line && (
              <Link className="button secondary" to={`/lines/${line.id}/cards`}>
                Повторити картки
              </Link>
            )}
            <button
              className="button primary"
              onClick={() => void start()}
              disabled={busy}
            >
              Тренуватися ще
              <ArrowRight size={16} />
            </button>
            <Link className="button secondary" to="/">
              До огляду
            </Link>
          </div>
        </div>
      ) : (
        <div className="quiz-shell">
          <div className="row small">
            <span>ВАШЕ ТРЕНУВАННЯ</span>
            <strong>
              {index + 1} / {session.questions.length}
            </strong>
          </div>
          <div
            className="quiz-lives"
            role="status"
            aria-label={`Життя: ${lives} із ${SESSION_LIVES}`}
          >
            {Array.from({ length: SESSION_LIVES }, (_, i) => (
              <Heart
                key={i}
                size={22}
                aria-hidden="true"
                fill={i < lives ? "currentColor" : "none"}
              />
            ))}
            <span>
              Життя: {lives} із {SESSION_LIVES}
            </span>
          </div>
          <ProgressBar
            value={(answers.length / session.questions.length) * 100}
          />
          <article className="question-card">
            <span className="question-type">
              <Brain size={16} />
              {session.questions[index].type}
            </span>
            <h2>{session.questions[index].prompt}</h2>
            <p className="muted">Оберіть найкращу відповідь.</p>
            <div className="answers">
              {session.questions[index].options.map((option, i) => (
                <button
                  key={option}
                  disabled={busy || !!feedback}
                  onClick={() => void answer(option)}
                  className={`answer ${feedback && option === feedback.answer ? "correct" : ""} ${feedback && selected === option && !feedback.correct ? "incorrect" : ""} ${selected === option ? "selected" : ""}`}
                >
                  <span className="answer-letter">
                    {["А", "Б", "В", "Г"][i]}
                  </span>
                  {option}
                  {feedback && option === feedback.answer && (
                    <Check size={18} />
                  )}
                </button>
              ))}
            </div>
            {feedback && (
              <div
                className={`feedback ${feedback.correct ? "success" : "retry"}`}
                role="status"
              >
                <div className="row">
                  <strong>
                    {feedback.correct ? (
                      <>
                        <Check size={18} />
                        Правильно!
                      </>
                    ) : (
                      <>
                        <CircleX size={18} />
                        Не зовсім — запам’ятаймо правильну відповідь.
                      </>
                    )}
                  </strong>
                  <span>
                    <Zap size={16} />+{feedback.xp} XP
                  </span>
                </div>
                <p>{feedback.explanation}</p>
                {lives === 0 && (
                  <p>
                    Це третя помилка. Тест завершено — перегляньте результати та
                    повторіть матеріал.
                  </p>
                )}
                <button
                  className="button primary"
                  onClick={() => {
                    if (lives === 0 || index + 1 === session.questions.length)
                      setFinished(true);
                    else setIndex(index + 1);
                    setFeedback(undefined);
                    setSelected("");
                  }}
                >
                  {lives === 0 || index + 1 === session.questions.length
                    ? "Переглянути результати"
                    : "Наступне запитання"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
            {busy && <p role="status">Зберігаємо відповідь…</p>}
          </article>
          <p className="quiz-note">
            Прогрес зберігається після кожної відповіді. Перехід на іншу
            сторінку завершує поточне тренування.
          </p>
        </div>
      )}
    </>
  );
}
