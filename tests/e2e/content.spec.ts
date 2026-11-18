import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Response } from "@playwright/test";
import { parse as parseYaml } from "yaml";
import { LEAK_CANARY } from "../../src/guest/leak-canary.ts";
import { revealView } from "../../src/host/reveal.ts";
import { secretStrings, type Label } from "../../src/question-set/model.ts";
import { loadQuestionSet } from "../../src/question-set/vite-plugin.ts";
import { findSecrets } from "../leak.ts";

// 期待値はローカルの問題ファイルから作る。BASE_URL でデプロイ先に流すときは、デプロイしたものと同じ content であること
const root = path.resolve(import.meta.dirname, "../..");
const set = loadQuestionSet(root);
const { questions } = set;
const secrets = secretStrings(set);
const last = questions.length - 1;
const contentDir = path.resolve(root, process.env.KAKUZUKE_CONTENT_DIR ?? "content");
const authored = parseYaml(readFileSync(path.join(contentDir, "questions.yaml"), "utf8")) as {
  readonly questions: readonly { readonly options: readonly { readonly image: string }[] }[];
};
const imageBaseNames = [
  ...new Set(authored.questions.flatMap((q) => q.options.map((o) => path.parse(o.image).name.normalize("NFC")))),
];

const SERVER_FN = "/_serverFn/";
const TEXT_TYPE = /^(text\/|application\/(javascript|json|xml)|application\/[\w.+-]+\+(json|xml)|image\/svg\+xml)/;
const BINARY_TYPE = /^(image\/|font\/|application\/(font-|x-font-|octet-stream))/;

const nextButton = (page: Page) => page.getByRole("button", { name: "次へ" });
const revealButton = (page: Page) => page.getByRole("button", { name: "正解発表" });
const card = (page: Page, label: Label) => page.locator(`.option-card[data-label="${label}"]`);

/** 第 index + 1 問の番号・問題名と全選択肢の写真が表示され、写真が読み込み済み */
async function expectQuestion(page: Page, index: number) {
  const q = questions[index];
  await expect(page.getByText(`${index + 1} / ${questions.length}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(q.title);
  await expect(page.getByRole("img", { name: /^選択肢 / })).toHaveCount(q.options.length);
  for (const o of q.options) {
    const photo = page.getByRole("img", { name: `選択肢 ${o.label}` });
    await expect(photo).toHaveAttribute("src", o.image);
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  }
}

/** 1920×1080 で、問題名・全選択肢・メッセージ欄・操作ボタンが表示領域と 16:9 の枠に収まり、ページも解説欄もスクロールしない。収まらない要素の一覧を返す */
async function overflows(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    void document.body.offsetHeight;
    await document.fonts.ready;
    // 枠の幅は端数になるので 1px の誤差は許す
    const EPSILON = 1;
    const frame = document.querySelector(".host")!.getBoundingClientRect();
    const view = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const inside = (r: DOMRect, box: { left: number; top: number; right: number; bottom: number }) =>
      r.left >= box.left - EPSILON && r.top >= box.top - EPSILON && r.right <= box.right + EPSILON && r.bottom <= box.bottom + EPSILON;
    const targets: [string, Element][] = [
      ["問題名", document.querySelector(".host-title")!],
      ...[...document.querySelectorAll(".option-card")].map((el): [string, Element] => [`選択肢 ${el.getAttribute("data-label")}`, el]),
      ["メッセージ欄", document.querySelector(".msg")!],
      ...[...document.querySelectorAll(".host-btns button")].map((el): [string, Element] => [`ボタン ${el.getAttribute("aria-label") ?? el.textContent}`, el]),
    ];
    const found: string[] = [];
    for (const [name, el] of targets) {
      const r = el.getBoundingClientRect();
      if (!inside(r, view)) found.push(`${name} が表示領域の外 ${JSON.stringify(r)}`);
      if (!inside(r, frame)) found.push(`${name} が枠の外 ${JSON.stringify(r)} 枠 ${JSON.stringify(frame)}`);
    }
    if (targets.length < 7) found.push(`測る要素が足りない（${targets.length} 個）`);
    const doc = document.documentElement;
    if (doc.scrollHeight > window.innerHeight) found.push(`ページが縦にスクロールする（${doc.scrollHeight} > ${window.innerHeight}）`);
    if (doc.scrollWidth > window.innerWidth) found.push(`ページが横にスクロールする（${doc.scrollWidth} > ${window.innerWidth}）`);
    // 解説が長いと写真の行が先に 0 まで縮み、枠からはみ出す前にラベルがカードの外へ出る
    for (const el of document.querySelectorAll(".option-card")) {
      if (el.scrollHeight > el.clientHeight) found.push(`選択肢 ${el.getAttribute("data-label")} の中身がカードに収まらない（${el.scrollHeight} > ${el.clientHeight}）`);
    }
    const msg = document.querySelector(".msg")!;
    if (msg.scrollHeight > msg.clientHeight) found.push(`メッセージ欄の中身が切れる（${msg.scrollHeight} > ${msg.clientHeight}）`);
    return found;
  });
}

/** 第 index + 1 問の正解発表が revealView のとおり表示されている */
async function expectRevealed(page: Page, index: number) {
  const view = revealView(questions[index]);
  await expect(page.getByText(`${view.headline}！`)).toBeVisible();
  await expect(page.locator(".msg")).toContainText(view.explanation);
  await expect(page.getByTestId("stamp")).toHaveCount(1);
  for (const o of view.options) {
    const tag = card(page, o.label).locator(".tag");
    await expect(tag).toContainText(o.name);
    await expect(tag).toContainText(o.price);
    if (o.rank !== null) await expect(tag).toContainText(`${o.rank}位`);
    if (o.correct) await expect(card(page, o.label).getByTestId("stamp")).toBeVisible();
  }
}

const drivers = [
  { name: "ボタン", reveal: (page: Page) => revealButton(page).click(), next: (page: Page) => nextButton(page).click() },
  { name: "キー", reveal: (page: Page) => page.keyboard.press("Space"), next: (page: Page) => page.keyboard.press("ArrowRight") },
];

test.describe("司会画面", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  for (const driver of drivers) {
    test(`${driver.name}で全問を進めて正解発表し、溢れずサーバー関数も呼ばない`, async ({ page }) => {
      const requests: string[] = [];
      page.on("request", (r) => requests.push(r.url()));

      await page.goto("/host");
      for (let i = 0; i <= last; i++) {
        if (i > 0) await driver.next(page);
        await expectQuestion(page, i);
        expect(await overflows(page), `第 ${i + 1} 問の正解発表前`).toEqual([]);
        await driver.reveal(page);
        await expectRevealed(page, i);
        expect(await overflows(page), `第 ${i + 1} 問の正解発表後`).toEqual([]);
      }
      await expect(nextButton(page)).toBeDisabled();

      await page.reload();
      await expectQuestion(page, last);

      expect(requests.some((url) => new URL(url).pathname === "/host"), "/host の取得を記録できている").toBe(true);
      expect(requests.filter((url) => url.includes(SERVER_FN))).toEqual([]);
    });
  }
});

test("参加者画面を最後まで進める間の応答に正解情報がなく、サーバー関数も呼ばない", async ({ page }) => {
  expect(secrets.length).toBeGreaterThan(0);
  expect(imageBaseNames.length).toBeGreaterThan(0);
  const requests: string[] = [];
  const responses: Response[] = [];
  const bodies: Promise<{ readonly url: string; readonly text: string }>[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("response", (r) => {
    responses.push(r);
    const type = r.headers()["content-type"] ?? "";
    if (r.status() >= 300 && r.status() < 400) return;
    if (TEXT_TYPE.test(type)) bodies.push(r.text().then((text) => ({ url: r.url(), text })));
  });

  await page.goto("/");
  await expect(nextButton(page)).toBeEnabled();
  await expectQuestion(page, 0);
  for (let i = 1; i <= last; i++) {
    await nextButton(page).click();
    await expectQuestion(page, i);
  }
  await expect(nextButton(page)).toBeDisabled();
  const texts = await Promise.all(bodies);

  expect(requests.filter((url) => url.includes(SERVER_FN))).toEqual([]);

  const unknown = responses
    .filter((r) => r.status() < 300 || r.status() >= 400)
    .map((r) => ({ url: r.url(), type: r.headers()["content-type"] ?? "" }))
    .filter(({ type }) => !TEXT_TYPE.test(type) && !BINARY_TYPE.test(type));
  expect(unknown, "中身を検査できない種類の応答").toEqual([]);

  expect(texts.some(({ text }) => findSecrets(text, [LEAK_CANARY]).length > 0), "陽性対照: 応答の中身からカナリアを読める").toBe(true);
  const leaks = texts.flatMap(({ url, text }) => findSecrets(text, secrets).map((hit) => `${url}: 「${hit.secret}」 …${hit.context}…`));
  expect(leaks).toEqual([]);

  const imageUrls = responses.filter((r) => (r.headers()["content-type"] ?? "").startsWith("image/")).map((r) => r.url());
  const shown = new Set(questions.flatMap((q) => q.options.map((o) => new URL(o.image, page.url()).href)));
  expect(imageUrls, "全問題の写真を受け取っている").toEqual(expect.arrayContaining([...shown]));
  const named = imageUrls.flatMap((url) => {
    const decoded = decodeURIComponent(url).normalize("NFC");
    return imageBaseNames.filter((name) => decoded.includes(name)).map((name) => `${url}: 「${name}」`);
  });
  expect(named).toEqual([]);
});
