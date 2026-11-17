import { expect, test } from "@playwright/test";

for (const [path, text] of [
  ["/", "参加者画面（仮）"],
  ["/host", `aria-label="司会画面"`],
]) {
  test(`GET ${path} returns 200 HTML without redirect`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    expect(await res.text()).toContain(text);
  });
}

test("写真はハッシュ名の URL で配信される", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const sources = [...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]);
  expect(sources.length).toBeGreaterThan(0);
  for (const src of sources) {
    expect(src).toMatch(/^\/images\/[0-9a-f]{12}\.(jpg|png)$/);
    const res = await request.get(src, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^image\//);
  }
});
