import type { Catalog, Stats } from "../../shared/schema";
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL ?? ""}/api${path}`,
    {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    },
  ).catch(() => {
    throw new Error(
      "Не вдалося з’єднатися із сервером. Перевірте підключення та спробуйте ще раз.",
    );
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({
      error: "API недоступний. Запустіть Worker і застосуйте міграції.",
    }))) as { error: string; code?: string; answers?: unknown };
    if (response.status === 401 && data.code === "AUTH_REQUIRED")
      window.dispatchEvent(new Event("beauty-auth-expired"));
    throw new ApiError(data.error, data.code, data.answers);
  }
  return response.json() as Promise<T>;
}
export const fetchData = () =>
  Promise.all([api<Catalog>("/catalog"), api<Stats>("/progress")]);
