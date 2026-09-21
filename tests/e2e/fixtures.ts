import { test as base, expect } from "@playwright/test";
export { expect };
export const ownerCredentials = {
  username: "e2e-owner",
  password: "Local-test-password-12345",
};
export const test = base.extend<{ authenticated: void }>({
  authenticated: [
    async ({ request, context }, use) => {
      const login = await request.post("/api/auth/login", {
        data: ownerCredentials,
      });
      if (!login.ok()) {
        const setup = await request.post("/api/auth/setup", {
          data: {
            ...ownerCredentials,
            setupKey: "local-e2e-owner-key-not-for-production-123456",
          },
        });
        expect(setup.ok()).toBe(true);
        const migrated = await (await request.get("/api/progress")).json();
        expect(migrated.history).toContainEqual(
          expect.objectContaining({
            id: "e2e-legacy-history",
            user_id: "owner",
            xp: 10,
          }),
        );
        expect(migrated.progress).toContainEqual(
          expect.objectContaining({
            entity_type: "line",
            entity_id: "curl-passion",
          }),
        );
      }
      const state = await request.storageState();
      await context.addCookies(state.cookies);
      await use();
    },
    { auto: true },
  ],
});
