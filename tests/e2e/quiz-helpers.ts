import type { Page } from "@playwright/test";
import type { PublicQuestion } from "../../shared/learning";

export function wrongAnswer(q: PublicQuestion, correct: string): string {
  if (!q.interaction) return q.options.find((o) => o !== correct)!;
  const values = JSON.parse(correct) as string[];
  if (q.interaction === "multiple")
    return JSON.stringify([q.options.find((o) => !values.includes(o))!]);
  if (q.interaction === "matching")
    return JSON.stringify([...values.slice(1), values[0]]);
  return JSON.stringify([q.options.find((o) => o !== values[0])!, values[1]]);
}

export function anyAnswer(q: PublicQuestion): string {
  if (!q.interaction) return q.options[0];
  if (q.interaction === "multiple") return JSON.stringify([q.options[0]]);
  if (q.interaction === "matching") return JSON.stringify(q.options);
  return JSON.stringify([q.options[0], q.reasons![0]]);
}

export async function answerInBrowser(
  page: Page,
  q: PublicQuestion,
  answer: string,
) {
  if (!q.interaction) {
    await page.locator("button.answer").nth(q.options.indexOf(answer)).click();
    return;
  }
  const values = JSON.parse(answer) as string[];
  if (q.interaction === "multiple") {
    for (const value of values)
      await page.getByRole("checkbox", { name: value, exact: true }).check();
  } else {
    for (let i = 0; i < values.length; i++)
      await page.getByRole("combobox").nth(i).selectOption(values[i]);
  }
  await page.getByRole("button", { name: "Перевірити", exact: true }).click();
}
