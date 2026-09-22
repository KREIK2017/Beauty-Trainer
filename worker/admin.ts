import { z } from "zod";
import type { User } from "../shared/auth";
import type { AdminAccount, AdminAccountDetail } from "../shared/admin";
import { siteSettings } from "./settings";
import { learningAccessSchema } from "../shared/access";
import { learningAccess } from "./access";
import { getCatalog } from "./db/catalog";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
// Aggregate history and product progress independently to avoid multiplying XP in joins.
const accountQuery = `WITH learning AS (
  SELECT user_id,SUM(xp) xp,COUNT(*) answers,SUM(correct) correct_answers,
  COUNT(DISTINCT session_id) sessions,MAX(created_at) last_practice_at
  FROM quiz_history GROUP BY user_id
), mastery AS (
  SELECT p.user_id,SUM(p.mastery_score>=80) mastered_products,SUM(p.mastery_score<60) weak_products
  FROM user_progress p JOIN products product ON product.id=p.entity_id
  WHERE p.entity_type='product' GROUP BY p.user_id
)
SELECT a.id,a.username,a.role,a.created_at,a.last_login_at,l.last_practice_at,
COALESCE(l.xp,0) xp,COALESCE(l.answers,0) answers,COALESCE(l.correct_answers,0) correct_answers,
COALESCE(l.sessions,0) sessions,COALESCE(m.mastered_products,0) mastered_products,COALESCE(m.weak_products,0) weak_products
FROM accounts a LEFT JOIN learning l ON l.user_id=a.id LEFT JOIN mastery m ON m.user_id=a.id`;

export async function adminRoute(
  request: Request,
  db: D1Database,
  user: User,
): Promise<Response> {
  if (user.role !== "admin")
    return json(
      { error: "Панель адміністратора доступна лише власнику." },
      403,
    );
  const url = new URL(request.url);
  if (url.pathname === "/api/admin/settings") {
    if (request.method === "GET") return json(await siteSettings(db));
    if (request.method === "PATCH") {
      const raw = await request.text();
      if (raw.length > 1024) return json({ error: "Завеликий запит" }, 400);
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return json({ error: "Некоректний JSON" }, 400);
      }
      const parsed = z
        .object({ registrationOpen: z.boolean() })
        .strict()
        .safeParse(data);
      if (!parsed.success)
        return json({ error: "Вкажіть, чи дозволена реєстрація." }, 400);
      await db
        .prepare(
          "UPDATE app_settings SET registration_open=?,updated_at=? WHERE id=1",
        )
        .bind(Number(parsed.data.registrationOpen), new Date().toISOString())
        .run();
      return json(await siteSettings(db));
    }
  }
  if (url.pathname === "/api/admin/users" && request.method === "GET") {
    const parsed = z
      .object({
        search: z.string().trim().max(40),
        page: z.coerce.number().int().min(1).max(100000),
      })
      .safeParse({
        search: url.searchParams.get("search") ?? "",
        page: url.searchParams.get("page") ?? "1",
      });
    if (!parsed.success)
      return json({ error: "Некоректні параметри пошуку." }, 400);
    const { search, page } = parsed.data;
    const pageSize = 25;
    const [users, total, summary] = await Promise.all([
      db
        .prepare(
          `${accountQuery} WHERE instr(lower(a.username),lower(?))>0 ORDER BY a.created_at DESC,a.id LIMIT ? OFFSET ?`,
        )
        .bind(search, pageSize, (page - 1) * pageSize)
        .all<AdminAccount>(),
      db
        .prepare(
          "SELECT COUNT(*) total FROM accounts WHERE instr(lower(username),lower(?))>0",
        )
        .bind(search)
        .first<{ total: number }>(),
      db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM accounts) accounts,
        (SELECT COUNT(DISTINCT h.user_id) FROM quiz_history h JOIN accounts a ON a.id=h.user_id WHERE h.created_at>=?) activeLearners,
        (SELECT COALESCE(SUM(h.xp),0) FROM quiz_history h JOIN accounts a ON a.id=h.user_id) totalXp`,
        )
        .bind(new Date(Date.now() - 7 * 86400000).toISOString())
        .first(),
    ]);
    return json({
      users: users.results,
      total: total!.total,
      page,
      pageSize,
      summary,
    });
  }
  const match = url.pathname.match(/^\/api\/admin\/users\/([a-z0-9-]+)$/);
  const accessMatch = url.pathname.match(
    /^\/api\/admin\/users\/([a-z0-9-]+)\/access$/,
  );
  if (
    (match && request.method === "DELETE") ||
    (accessMatch && request.method === "PUT")
  ) {
    const id = (accessMatch ?? match)![1];
    const account = await db
      .prepare("SELECT id,username,role FROM accounts WHERE id=?")
      .bind(id)
      .first<User>();
    if (!account) return json({ error: "Акаунт не знайдено." }, 404);
    if (account.role === "admin" || account.id === user.id)
      return json(
        { error: "Акаунт власника не можна видалити або обмежити." },
        403,
      );
    const raw = await request.text();
    if (raw.length > 100000) return json({ error: "Завеликий запит" }, 400);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: "Некоректний JSON" }, 400);
    }
    if (request.method === "DELETE") {
      const parsed = z
        .object({ username: z.literal(account.username) })
        .strict()
        .safeParse(data);
      if (!parsed.success)
        return json(
          { error: "Для підтвердження введіть логін користувача." },
          400,
        );
      await db.batch([
        ...["user_progress", "quiz_history", "quiz_sessions"].map((table) =>
          db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(id),
        ),
        db
          .prepare("DELETE FROM accounts WHERE id=? AND role='learner'")
          .bind(id),
      ]);
      return json({ success: true });
    }
    const parsed = learningAccessSchema.safeParse(data);
    if (!parsed.success)
      return json({ error: "Некоректний список навчальних матеріалів." }, 400);
    const catalog = await getCatalog(db);
    const { allMaterials, brandIds, lineIds } = parsed.data;
    if (
      brandIds.some((id) => !catalog.brands.some((b) => b.id === id)) ||
      lineIds.some((id) => !catalog.lines.some((l) => l.id === id))
    )
      return json(
        { error: "Деякі матеріали більше не існують. Оновіть сторінку." },
        400,
      );
    await db.batch([
      db
        .prepare(
          "INSERT INTO account_learning_access (user_id,all_materials,brand_ids,line_ids,revision) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET all_materials=excluded.all_materials,brand_ids=excluded.brand_ids,line_ids=excluded.line_ids,revision=excluded.revision",
        )
        .bind(
          id,
          Number(allMaterials),
          JSON.stringify([...new Set(brandIds)]),
          JSON.stringify([...new Set(lineIds)]),
          crypto.randomUUID(),
        ),
      db
        .prepare("UPDATE quiz_sessions SET questions='[]' WHERE user_id=?")
        .bind(id),
    ]);
    return json({ success: true });
  }
  if (match && request.method === "GET") {
    const account = await db
      .prepare(`${accountQuery} WHERE a.id=?`)
      .bind(match[1])
      .first<AdminAccount>();
    if (!account) return json({ error: "Акаунт не знайдено." }, 404);
    const [progress, recentAnswers] = await Promise.all([
      db
        .prepare(
          `SELECT p.entity_type,p.entity_id,p.correct_answers,p.incorrect_answers,p.mastery_score,p.last_reviewed_at,p.next_review_at,
        COALESCE(product.name,line.name,brand.name,'Видалений матеріал') name FROM user_progress p
        LEFT JOIN products product ON p.entity_type='product' AND product.id=p.entity_id
        LEFT JOIN product_lines line ON p.entity_type='line' AND line.id=p.entity_id
        LEFT JOIN brands brand ON p.entity_type='brand' AND brand.id=p.entity_id
        WHERE p.user_id=? ORDER BY p.mastery_score,p.entity_type,p.entity_id`,
        )
        .bind(account.id)
        .all<AdminAccountDetail["progress"][number]>(),
      db
        .prepare(
          `SELECT h.id,h.correct,h.xp,h.created_at,COALESCE(p.name,l.name,'Видалений матеріал') topic
        FROM quiz_history h LEFT JOIN products p ON p.id=h.product_id LEFT JOIN product_lines l ON l.id=h.line_id
        WHERE h.user_id=? ORDER BY h.created_at DESC,h.id DESC LIMIT 20`,
        )
        .bind(account.id)
        .all<AdminAccountDetail["recentAnswers"][number]>(),
    ]);
    const access = await learningAccess(db, account);
    return json({
      account,
      access: {
        allMaterials: access.allMaterials,
        brandIds: access.brandIds,
        lineIds: access.lineIds,
      },
      progress: progress.results,
      recentAnswers: recentAnswers.results,
    });
  }
  return json({ error: "Шлях API не знайдено" }, 404);
}
