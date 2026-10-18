import type { SiteSettings } from "../shared/admin";

export async function siteSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db
    .prepare(
      "SELECT registration_open,invitation_code_hash,updated_at FROM app_settings WHERE id=1",
    )
    .first<{
      registration_open: number;
      invitation_code_hash: string | null;
      updated_at: string;
    }>();
  if (!row) throw new Error("Missing app settings migration");
  return {
    registrationOpen: row.registration_open === 1,
    invitationCodeConfigured: !!row.invitation_code_hash,
    updatedAt: row.updated_at,
  };
}
