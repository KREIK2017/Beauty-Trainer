import { z } from "zod";
import type { User } from "../shared/auth";
import { siteSettings } from "./settings";

export interface AuthEnv {
  DB: D1Database;
  OWNER_SETUP_KEY?: string;
}
const credentials = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_-]{3,40}$/,
      "Логін: 3–40 латинських літер, цифр, дефісів або підкреслень.",
    ),
  password: z
    .string()
    .min(12, "Пароль має містити щонайменше 12 символів.")
    .max(128),
  setupKey: z.string().max(256).optional(),
});
const encoder = new TextEncoder();
const hex = (value: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(value), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
async function digest(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // Workers Web Crypto caps PBKDF2 at 100,000 iterations.
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: encoder.encode(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
}
function equal(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export async function ownerKeyError(
  secret: string | undefined,
  provided: string | undefined,
) {
  const expected = secret?.trim();
  if (!expected)
    return {
      code: "OWNER_SETUP_NOT_CONFIGURED",
      error:
        "У цій версії сайту не налаштовано OWNER_SETUP_KEY. Додайте секрет до Worker beauty-trainer.",
    };
  if (expected.length < 32)
    return {
      code: "OWNER_SETUP_INVALID_CONFIG",
      error:
        "Ключ OWNER_SETUP_KEY у налаштуваннях Worker закороткий: потрібно щонайменше 32 символи.",
    };
  if (!equal(await digest(provided?.trim() ?? ""), await digest(expected)))
    return {
      code: "OWNER_SETUP_KEY_MISMATCH",
      error:
        "Введений ключ не збігається з OWNER_SETUP_KEY цієї версії сайту. Вставте значення секрету, а не його назву чи пароль акаунта.",
    };
}
function cookieName(request: Request) {
  return new URL(request.url).protocol === "https:"
    ? "__Host-beauty_session"
    : "beauty_session";
}
function token(request: Request) {
  return (
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName(request)}=`))
      ?.split("=")[1] ?? ""
  );
}
function cookie(request: Request, value: string, age: number) {
  return `${cookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export async function currentUser(
  request: Request,
  db: D1Database,
): Promise<User | null> {
  const value = token(request);
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return db
    .prepare(
      "SELECT a.id,a.username,a.role FROM auth_sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(await digest(value), Date.now())
    .first<User>();
}
async function signIn(
  request: Request,
  db: D1Database,
  user: User,
  expectedHash: string,
) {
  const value = random();
  const tokenHash = await digest(value);
  const result = await db.batch([
    db
      .prepare("DELETE FROM auth_sessions WHERE expires_at<=?")
      .bind(Date.now()),
    db
      .prepare(
        "INSERT INTO auth_sessions (token_hash,user_id,expires_at) SELECT ?,id,? FROM accounts WHERE id=? AND password_hash=?",
      )
      .bind(tokenHash, Date.now() + 7 * 86400000, user.id, expectedHash),
    db
      .prepare(
        "UPDATE accounts SET last_login_at=? WHERE id=? AND EXISTS(SELECT 1 FROM auth_sessions WHERE token_hash=?)",
      )
      .bind(new Date().toISOString(), user.id, tokenHash),
  ]);
  if (!result[1].meta.changes)
    return json(
      { error: "Дані входу змінилися. Увійдіть із поточним паролем." },
      401,
    );
  return json({ user }, 200, {
    "Set-Cookie": cookie(request, value, 7 * 86400),
  });
}
async function limited(request: Request, db: D1Database, username: string) {
  const now = Date.now();
  const keys = [
    await digest(`ip:${request.headers.get("CF-Connecting-IP") ?? "local"}`),
    await digest(`user:${username}`),
  ];
  await db
    .prepare("DELETE FROM auth_attempts WHERE expires_at<=?")
    .bind(now)
    .run();
  const results = await db.batch(
    keys.map((key) =>
      db
        .prepare(
          "INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
        )
        .bind(key, now + 15 * 60000),
    ),
  );
  return results.some(
    (r, i) =>
      Number((r.results[0] as { attempts: number }).attempts) >
      (i === 0 ? 60 : 30),
  );
}
export async function authRoute(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/me" && request.method === "GET")
    return json({
      user: await currentUser(request, env.DB),
      registrationOpen: (await siteSettings(env.DB)).registrationOpen,
    });
  if (path === "/api/auth/logout" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?")
      .bind(await digest(token(request)))
      .run();
    return json({ success: true }, 200, {
      "Set-Cookie": cookie(request, "", 0),
    });
  }
  if (path === "/api/auth/password" && request.method === "POST") {
    const user = await currentUser(request, env.DB);
    if (!user)
      return json(
        { error: "Увійдіть у свій акаунт.", code: "AUTH_REQUIRED" },
        401,
      );
    if (user.role !== "admin")
      return json({ error: "Налаштування доступні лише власнику." }, 403);
    if (await limited(request, env.DB, `password:${user.id}`))
      return json(
        { error: "Забагато спроб. Спробуйте через 15 хвилин." },
        429,
        { "Retry-After": "900" },
      );
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "Завеликий запит" }, 400);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: "Некоректний JSON" }, 400);
    }
    const parsed = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: credentials.shape.password,
      })
      .strict()
      .safeParse(data);
    if (!parsed.success)
      return json(
        {
          error:
            "Вкажіть поточний пароль і новий пароль від 12 до 128 символів.",
        },
        400,
      );
    const account = await env.DB.prepare(
      "SELECT password_hash,salt FROM accounts WHERE id=?",
    )
      .bind(user.id)
      .first<{ password_hash: string; salt: string }>();
    if (
      !account ||
      !equal(
        await passwordHash(parsed.data.currentPassword, account.salt),
        account.password_hash,
      )
    )
      return json({ error: "Поточний пароль неправильний." }, 400);
    if (parsed.data.currentPassword === parsed.data.newPassword)
      return json(
        { error: "Новий пароль має відрізнятися від поточного." },
        400,
      );
    const salt = random();
    const hash = await passwordHash(parsed.data.newPassword, salt);
    const changed = await env.DB.batch([
      env.DB.prepare(
        "UPDATE accounts SET password_hash=?,salt=? WHERE id=? AND password_hash=?",
      ).bind(hash, salt, user.id, account.password_hash),
      env.DB.prepare(
        "DELETE FROM auth_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND password_hash=?)",
      ).bind(user.id, user.id, hash),
    ]);
    if (!changed[0].meta.changes)
      return json({ error: "Пароль уже змінився. Спробуйте ще раз." }, 409);
    return signIn(request, env.DB, user, hash);
  }
  if (
    !["/api/auth/login", "/api/auth/register", "/api/auth/setup"].includes(
      path,
    ) ||
    request.method !== "POST"
  )
    return json({ error: "Шлях API не знайдено" }, 404);
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: "Завеликий запит" }, 400);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "Некоректний JSON" }, 400);
  }
  const parsed = credentials.safeParse(data);
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);
  const { username, password, setupKey } = parsed.data;
  if (await limited(request, env.DB, username))
    return json({ error: "Забагато спроб. Спробуйте через 15 хвилин." }, 429, {
      "Retry-After": "900",
    });
  if (path === "/api/auth/login") {
    const account = await env.DB.prepare(
      "SELECT * FROM accounts WHERE username=?",
    )
      .bind(username)
      .first<User & { password_hash: string; salt: string }>();
    const hash = await passwordHash(
      password,
      account?.salt ?? "missing-account-dummy-salt",
    );
    if (!account || !equal(hash, account.password_hash))
      return json({ error: "Неправильний логін або пароль." }, 401);
    return signIn(
      request,
      env.DB,
      {
        id: account.id,
        username: account.username,
        role: account.role,
      },
      account.password_hash,
    );
  }
  const owner = path === "/api/auth/setup";
  if (!owner && !(await siteSettings(env.DB)).registrationOpen)
    return json(
      {
        error:
          "Реєстрацію нових акаунтів тимчасово закрито. Якщо маєте акаунт, увійдіть.",
      },
      403,
    );
  if (owner) {
    const keyError = await ownerKeyError(env.OWNER_SETUP_KEY, setupKey);
    if (keyError)
      return json(
        keyError,
        keyError.code === "OWNER_SETUP_KEY_MISMATCH" ? 403 : 503,
      );
  }
  if (
    owner &&
    (await env.DB.prepare("SELECT id FROM accounts WHERE id='owner'").first())
  )
    return json(
      { error: "Акаунт власника вже створено. Скористайтеся входом." },
      409,
    );
  const user: User = {
    id: owner ? "owner" : crypto.randomUUID(),
    username,
    role: owner ? "admin" : "learner",
  };
  const salt = random();
  const hash = await passwordHash(password, salt);
  const statements = [
    env.DB.prepare(
      "INSERT INTO accounts (id,username,password_hash,salt,role,created_at) SELECT ?,?,?,?,?,? WHERE ?=1 OR EXISTS(SELECT 1 FROM app_settings WHERE id=1 AND registration_open=1)",
    ).bind(
      user.id,
      username,
      hash,
      salt,
      user.role,
      new Date().toISOString(),
      Number(owner),
    ),
  ];
  if (owner)
    for (const table of ["user_progress", "quiz_history", "quiz_sessions"])
      statements.push(
        env.DB.prepare(
          `UPDATE ${table} SET user_id='owner' WHERE user_id='local'`,
        ),
      );
  try {
    const inserted = await env.DB.batch(statements);
    if (!inserted[0].meta.changes)
      return json(
        { error: "Реєстрацію нових акаунтів тимчасово закрито." },
        403,
      );
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint/i.test(error.message))
      return json(
        { error: "Цей логін уже зайнятий або власник уже зареєстрований." },
        409,
      );
    throw error;
  }
  return signIn(request, env.DB, user, hash);
}
