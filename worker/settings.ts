import type { SiteSettings } from "../shared/admin";

export async function siteSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db
    .prepare("SELECT registration_open,updated_at FROM app_settings WHERE id=1")
    .first<{ registration_open: number; updated_at: string }>();
  if (!row) throw new Error("Missing app settings migration");
  return {
    registrationOpen: row.registration_open === 1,
    updatedAt: row.updated_at,
  };
}
