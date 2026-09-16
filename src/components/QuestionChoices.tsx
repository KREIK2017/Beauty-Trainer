import { useState } from "react";
import type { PublicQuestion } from "../../shared/learning";

export function QuestionChoices({
  question: q,
  disabled,
  submit,
}: {
  question: PublicQuestion;
  disabled: boolean;
  submit: (answer: string) => void;
}) {
  const [choices, setChoices] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<number>();
  const complete =
    q.interaction === "multiple"
      ? choices.length > 0
      : q.interaction === "matching"
        ? choices.filter(Boolean).length === q.items?.length &&
          new Set(choices).size === choices.length
        : choices.filter(Boolean).length === 2;
  function choose(index: number, value: string) {
    setChoices((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }
  return (
    <div className="complex-question">
      <p className="muted">
        Складіть відповідь і натисніть «Перевірити». За все завдання можна
        втратити лише одне життя.
      </p>
      <fieldset disabled={disabled}>
        <legend>
          {q.interaction === "multiple"
            ? "Оберіть усі потрібні варіанти"
            : q.interaction === "matching"
              ? "Кожне призначення використайте один раз"
              : "Продукт і пояснення"}
        </legend>
        {q.interaction === "matching" ? (
          <>
            <p className="muted">
              Натисніть продукт, потім його призначення. Щоб змінити пару,
              виберіть продукт ще раз. Вибір уже зайнятого призначення перенесе
              його до нової пари.
            </p>
            <p role="status">
              {activeItem === undefined
                ? `Поєднано: ${choices.filter(Boolean).length} із ${q.items!.length}`
                : `Оберіть призначення для: ${q.items![activeItem]}`}
            </p>
            <div className="matching-board">
              <div role="group" aria-label="Продукти для зіставлення">
                <h3>1. Продукт</h3>
                {q.items!.map((item, i) => (
                  <button
                    type="button"
                    data-match-product
                    key={item}
                    className={`match-choice ${activeItem === i ? "active" : ""}`}
                    aria-pressed={activeItem === i}
                    onClick={() => setActiveItem(i)}
                  >
                    <strong>
                      {i + 1}. {item}
                    </strong>
                    <span>
                      {choices[i]
                        ? `Призначення ${q.options.indexOf(choices[i]) + 1}`
                        : "Пару ще не обрано"}
                    </span>
                  </button>
                ))}
              </div>
              <div role="group" aria-label="Призначення для зіставлення">
                <h3>2. Призначення</h3>
                {q.options.map((option, i) => (
                  <button
                    type="button"
                    data-match-option
                    key={option}
                    className="match-choice"
                    disabled={activeItem === undefined}
                    onClick={() => {
                      if (activeItem === undefined) return;
                      setChoices((previous) => {
                        const next = Array.from(
                          { length: q.items!.length },
                          (_, index) =>
                            previous[index] === option
                              ? ""
                              : (previous[index] ?? ""),
                        );
                        next[activeItem] = option;
                        return next;
                      });
                      setActiveItem(undefined);
                    }}
                  >
                    <strong>
                      {i + 1}. {option}
                    </strong>
                    <span>
                      {choices.includes(option)
                        ? `Поєднано з продуктом ${choices.indexOf(option) + 1}`
                        : "Вільне призначення"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="button secondary"
              disabled={!choices.some(Boolean)}
              onClick={() => {
                setChoices([]);
                setActiveItem(undefined);
              }}
            >
              Скинути пари
            </button>
          </>
        ) : q.interaction === "multiple" ? (
          q.options.map((option) => (
            <label className="answer" key={option}>
              <input
                type="checkbox"
                checked={choices.includes(option)}
                onChange={() =>
                  setChoices((previous) =>
                    previous.includes(option)
                      ? previous.filter((x) => x !== option)
                      : [...previous, option],
                  )
                }
              />
              {option}
            </label>
          ))
        ) : (
          ["Оберіть продукт", "Оберіть пояснення"].map((item, i) => (
            <label className="question-select" key={item}>
              <span>{item}</span>
              <select
                value={choices[i] ?? ""}
                onChange={(event) => choose(i, event.target.value)}
              >
                <option value="">Оберіть варіант</option>
                {(q.interaction === "reasoning" && i === 1
                  ? q.reasons!
                  : q.options
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {q.interaction === "reasoning" && choices[i] && (
                <span className="selected-explanation">{choices[i]}</span>
              )}
            </label>
          ))
        )}
      </fieldset>
      <button
        className="button primary"
        disabled={disabled || !complete}
        onClick={() => submit(JSON.stringify(choices))}
      >
        Перевірити
      </button>
    </div>
  );
}
