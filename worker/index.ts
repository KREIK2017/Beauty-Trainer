import { z, ZodError } from "zod";
import {
  brandSchema,
  lineSchema,
  productSchema,
  catalogSchema,
  type Progress,
  type History,
} from "../shared/schema";
import {
  generateQuestions,
  normalizeAnswer,
  formatAnswer,
  SESSION_LIVES,
  type Question,
} from "../shared/learning";
import { getCatalog, catalogStatements } from "./db/catalog";
import { errorMessage } from "../shared/uk";
import { authRoute, currentUser } from "./auth";
import { adminRoute } from "./admin";
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OWNER_SETUP_KEY?: string;
}
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(request: Request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 2_000_000)
    throw new Error("Розмір імпорту перевищує 2 МБ");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Запит має містити коректний JSON");
  }
}
async function stats(db: D1Database, userId: string) {
  const [p, h] = await Promise.all([
    db
      .prepare("SELECT * FROM user_progress WHERE user_id=?")
      .bind(userId)
      .all<Progress>(),
    db
      .prepare(
        "SELECT * FROM quiz_history WHERE user_id=? ORDER BY created_at DESC",
      )
      .bind(userId)
      .all<History>(),
  ]);
  const days = new Set(h.results.map((x) => x.created_at.slice(0, 10)));
  let streak = 0;
  const date = new Date();
  if (!days.has(date.toISOString().slice(0, 10)))
    date.setUTCDate(date.getUTCDate() - 1);
  while (days.has(date.toISOString().slice(0, 10))) {
    streak++;
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return {
    progress: p.results,
    history: h.results,
    xp: h.results.reduce((n, x) => n + x.xp, 0),
    streak,
  };
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      request.headers.get("Origin") &&
      request.headers.get("Origin") !== url.origin
    )
      return json({ error: "Зміни з іншого джерела не дозволені" }, 403);
    try {
      if (path.startsWith("/api/auth/")) return await authRoute(request, env);
      if (path === "/api/catalog" && request.method === "GET")
        return json(await getCatalog(env.DB));
      const user = await currentUser(request, env.DB);
      if (!user)
        return json(
          { error: "Увійдіть у свій акаунт.", code: "AUTH_REQUIRED" },
          401,
        );
      const userId = user.id;
      if (path.startsWith("/api/admin/"))
        return await adminRoute(request, env.DB, user);
      if (
        (path === "/api/import" ||
          /^\/api\/(brands|lines|products)(\/|$)/.test(path)) &&
        user.role !== "admin"
      )
        return json({ error: "Редагувати каталог може лише власник." }, 403);
      if (path === "/api/progress" && request.method === "GET")
        return json(await stats(env.DB, userId));
      if (path === "/api/import" && request.method === "POST") {
        const incoming = catalogSchema.parse(await body(request));
        const current = await getCatalog(env.DB);
        catalogSchema.parse({
          brands: [
            ...current.brands.filter(
              (x) => !incoming.brands.some((y) => y.id === x.id),
            ),
            ...incoming.brands,
          ],
          lines: [
            ...current.lines.filter(
              (x) => !incoming.lines.some((y) => y.id === x.id),
            ),
            ...incoming.lines,
          ],
          products: [
            ...current.products.filter(
              (x) => !incoming.products.some((y) => y.id === x.id),
            ),
            ...incoming.products,
          ],
        });
        const statements = catalogStatements(env.DB, incoming);
        if (statements.length > 40)
          return json(
            {
              error:
                "Імпорт потребує забагато операцій для одного запиту. Розділіть продукти на менші файли, додавши відповідні бренди й лінійки до кожного файла.",
            },
            400,
          );
        if (statements.length) await env.DB.batch(statements);
        return json({ success: true, products: incoming.products.length });
      }
      const match = path.match(
        /^\/api\/(brands|lines|products)(?:\/([a-z0-9-]+))?$/,
      );
      if (match) {
        const kind = match[1] as "brands" | "lines" | "products";
        const id = match[2];
        const table = {
          brands: "brands",
          lines: "product_lines",
          products: "products",
        }[kind];
        if (request.method === "DELETE" && id) {
          const result = await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`)
            .bind(id)
            .run();
          return result.meta.changes
            ? json({ success: true })
            : json({ error: "Запис не знайдено" }, 404);
        }
        if (request.method === "POST" || request.method === "PUT") {
          const value = {
            brands: brandSchema,
            lines: lineSchema,
            products: productSchema,
          }[kind].parse(await body(request));
          const c = await getCatalog(env.DB);
          const exists = c[kind].some((x) => x.id === value.id);
          if (request.method === "POST" && exists)
            return json({ error: "Такий ID уже існує" }, 409);
          if (request.method === "PUT" && (!exists || id !== value.id))
            return json(
              { error: "Запис не знайдено або ID не збігається" },
              404,
            );
          const merged = catalogSchema.parse({
            ...c,
            [kind]: [...c[kind].filter((x) => x.id !== value.id), value],
          });
          const changed = {
            brands: merged.brands.filter(
              (x) => kind === "brands" && x.id === value.id,
            ),
            lines: merged.lines.filter(
              (x) => kind === "lines" && x.id === value.id,
            ),
            products: merged.products.filter(
              (x) => kind === "products" && x.id === value.id,
            ),
          };
          await env.DB.batch(catalogStatements(env.DB, changed));
          return json({ success: true });
        }
      }
      if (path === "/api/sessions" && request.method === "POST") {
        const input = z
          .object({
            mode: z.enum(["all", "weak"]).default("all"),
            difficulty: z.enum(["normal", "hard"]).default("normal"),
            lineId: lineSchema.shape.id.optional(),
          })
          .parse(await body(request));
        const catalog = await getCatalog(env.DB);
        if (input.lineId && !catalog.lines.some((l) => l.id === input.lineId))
          return json({ error: "Лінійку не знайдено" }, 404);
        const id = crypto.randomUUID();
        const s = await stats(env.DB, userId);
        const questions = generateQuestions(
          catalog,
          s.progress,
          input.mode,
          id,
          new Date(),
          input.lineId,
          input.difficulty,
        );
        await env.DB.prepare("INSERT INTO quiz_sessions VALUES (?,?,?,?)")
          .bind(id, userId, JSON.stringify(questions), new Date().toISOString())
          .run();
        return json({
          id,
          questions: questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            interaction: q.interaction,
            image: q.image,
            items: q.items,
            reasons: q.reasons,
          })),
        });
      }
      const answerMatch = path.match(
        /^\/api\/sessions\/([a-f0-9-]+)\/answers$/,
      );
      if (answerMatch && request.method === "POST") {
        const input = z
          .object({ questionId: z.string(), answer: z.string() })
          .parse(await body(request));
        const session = await env.DB.prepare(
          "SELECT questions FROM quiz_sessions WHERE id=? AND user_id=?",
        )
          .bind(answerMatch[1], userId)
          .first<{ questions: string }>();
        if (!session) return json({ error: "Тренування не знайдено" }, 404);
        const q = (JSON.parse(session.questions) as Question[]).find(
          (q) => q.id === input.questionId,
        );
        if (!q || normalizeAnswer(q, input.answer) === undefined)
          return json({ error: "Некоректне запитання або відповідь" }, 400);
        const old = await env.DB.prepare(
          "SELECT * FROM quiz_history WHERE session_id=? AND question_id=?",
        )
          .bind(answerMatch[1], q.id)
          .first<History>();
        if (old)
          return json({
            correct: !!old.correct,
            xp: old.xp,
            answer: old.correct_answer,
            explanation: q.explanation,
            productId: q.productId,
            lineId: q.lineId,
          });
        const c = await getCatalog(env.DB);
        if (
          !c.lines.some((l) => l.id === q.lineId) ||
          (q.productId && !c.products.some((p) => p.id === q.productId))
        )
          return json(
            { error: "Каталог змінився. Почніть нове тренування." },
            409,
          );
        const correct = normalizeAnswer(q, input.answer) === q.answer;
        const xp = correct ? 10 : 0;
        const now = new Date().toISOString();
        const historyId = crypto.randomUUID();
        const statements = [
          env.DB.prepare(
            "INSERT OR IGNORE INTO quiz_history SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM quiz_history WHERE session_id=? AND correct=0) < ?",
          ).bind(
            historyId,
            userId,
            answerMatch[1],
            q.id,
            q.productId ?? null,
            q.lineId,
            formatAnswer(q, input.answer),
            formatAnswer(q, q.answer),
            Number(correct),
            xp,
            now,
            answerMatch[1],
            SESSION_LIVES,
          ),
        ];
        // Conditional writes make retries and simultaneous submissions award progress only once.
        for (const [type, id] of [
          ["brand", q.brandId],
          ["line", q.lineId],
          ...(q.productId ? [["product", q.productId]] : []),
        ]) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO user_progress (user_id,entity_type,entity_id,correct_answers,incorrect_answers,mastery_score,last_reviewed_at,next_review_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM quiz_history WHERE id=?) ON CONFLICT(user_id,entity_type,entity_id) DO UPDATE SET correct_answers=correct_answers+excluded.correct_answers,incorrect_answers=incorrect_answers+excluded.incorrect_answers,mastery_score=MAX(0,MIN(100,mastery_score+?)),last_reviewed_at=excluded.last_reviewed_at`,
            ).bind(
              userId,
              type,
              id,
              Number(correct),
              Number(!correct),
              correct ? 15 : 0,
              now,
              now,
              historyId,
              correct ? 15 : -20,
            ),
          );
          statements.push(
            env.DB.prepare(
              `UPDATE user_progress SET next_review_at=strftime('%Y-%m-%dT%H:%M:%fZ',?, CASE WHEN ?=0 THEN '+10 minutes' WHEN mastery_score<=20 THEN '+4 hours' WHEN mastery_score<=40 THEN '+1 day' WHEN mastery_score<=60 THEN '+3 days' WHEN mastery_score<=80 THEN '+7 days' WHEN mastery_score<100 THEN '+14 days' ELSE '+30 days' END) WHERE user_id=? AND entity_type=? AND entity_id=? AND EXISTS(SELECT 1 FROM quiz_history WHERE id=?)`,
            ).bind(now, Number(correct), userId, type, id, historyId),
          );
        }
        await env.DB.batch(statements);
        const saved = await env.DB.prepare(
          "SELECT * FROM quiz_history WHERE session_id=? AND question_id=?",
        )
          .bind(answerMatch[1], q.id)
          .first<History>();
        if (!saved) {
          const history = await env.DB.prepare(
            "SELECT * FROM quiz_history WHERE session_id=? ORDER BY created_at",
          )
            .bind(answerMatch[1])
            .all<History>();
          return json(
            {
              error: "Життя закінчилися. Почніть нове тренування.",
              code: "SESSION_EXHAUSTED",
              answers: history.results.map((h) => ({
                correct: !!h.correct,
                xp: h.xp,
                answer: h.correct_answer,
                explanation:
                  (JSON.parse(session.questions) as Question[]).find(
                    (item) => item.id === h.question_id,
                  )?.explanation ?? h.correct_answer,
                productId: h.product_id ?? undefined,
                lineId: h.line_id,
              })),
            },
            409,
          );
        }
        return json({
          correct: !!saved!.correct,
          xp: saved!.xp,
          answer: saved!.correct_answer,
          explanation: q.explanation,
          productId: q.productId,
          lineId: q.lineId,
        });
      }
      return json({ error: "Шлях API не знайдено" }, 404);
    } catch (error) {
      if (error instanceof ZodError)
        return json(
          {
            error: errorMessage(error),
          },
          400,
        );
      if (error instanceof Error && /коректний JSON|2 МБ/.test(error.message))
        return json({ error: error.message }, 400);
      console.error(error);
      return json(
        {
          error:
            "Не вдалося виконати запит. Перевірте налаштування бази даних і журнали Worker.",
        },
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
