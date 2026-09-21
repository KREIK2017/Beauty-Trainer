import { test, expect } from "./fixtures";

test("authentication attempts are rate limited", async ({ request }) => {
  let status = 0;
  for (let attempt = 0; attempt < 31; attempt++) {
    const response = await request.post("/api/auth/login", {
      data: {
        username: "unknown-rate-test",
        password: "Incorrect-password-12345",
      },
    });
    status = response.status();
    if (status === 429) {
      expect(response.headers()["retry-after"]).toBe("900");
      break;
    }
    expect(status).toBe(401);
  }
  expect(status).toBe(429);
});
