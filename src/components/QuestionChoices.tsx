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
        {q.interaction === "matching" && (
          <ol className="matching-options">
            {q.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ol>
        )}
        {q.interaction === "multiple"
          ? q.options.map((option) => (
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
          : (q.interaction === "matching"
              ? q.items!
              : ["Оберіть продукт", "Оберіть пояснення"]
            ).map((item, i) => (
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
                  ).map((option, optionIndex) => (
                    <option key={option} value={option}>
                      {q.interaction === "matching"
                        ? `Призначення ${optionIndex + 1}`
                        : option}
                    </option>
                  ))}
                </select>
                {q.interaction === "reasoning" && choices[i] && (
                  <span className="selected-explanation">{choices[i]}</span>
                )}
              </label>
            ))}
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
