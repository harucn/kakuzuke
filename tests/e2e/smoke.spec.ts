import { expect, test } from "@playwright/test";

for (const [path, text] of [
  ["/", "参加者画面（仮）"],
  ["/host", "司会画面（仮）"],
]) {
  test(`GET ${path} returns 200 HTML without redirect`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    expect(await res.text()).toContain(text);
  });
}
