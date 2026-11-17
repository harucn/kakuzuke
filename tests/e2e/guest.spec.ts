import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { secretStrings } from "../../src/question-set/model.ts";
import { loadQuestionSet } from "../../src/question-set/vite-plugin.ts";

// package.json の e2e がこのフィクスチャでビルドした dist に対して流す
const set = loadQuestionSet(path.resolve(import.meta.dirname, "../.."), { contentDir: "tests/fixtures/content" });
const secrets = secretStrings(set);
const last = set.length - 1;
const THREE_OPTIONS = 1;
if (set[THREE_OPTIONS].options.length !== 3) throw new Error(`フィクスチャの第 ${THREE_OPTIONS + 1} 問は 3 択の前提`);

const prevButton = (page: Page) => page.getByRole("button", { name: "前へ" });
const nextButton = (page: Page) => page.getByRole("button", { name: "次へ" });
const photo = (page: Page, label: string) => page.getByRole("img", { name: `選択肢 ${label}` });
const labelBar = (page: Page, label: string) => page.locator(`.option-card[data-label="${label}"]`).getByText(label, { exact: true });

/** 事前レンダリングの HTML ではボタンが無効で、hydration 後に次へが有効になる。押す前にそれを待つ */
async function openGuest(page: Page) {
  await page.goto("/");
  await expect(nextButton(page)).toBeEnabled();
  await expectQuestion(page, 0);
}

/** 第 index + 1 問の問題名・説明・全選択肢・番号が表示されている */
async function expectQuestion(page: Page, index: number) {
  const q = set[index];
  await expect(page.getByRole("heading", { level: 1 })).toContainText(q.title);
  await expect(page.getByText(`${index + 1} / ${set.length}`)).toBeVisible();
  await expect(page.getByText(q.description)).toBeVisible();
  await expect(page.getByRole("img", { name: /^選択肢 / })).toHaveCount(q.options.length);
  for (const o of q.options) {
    await expect(labelBar(page, o.label)).toBeVisible();
    await expect(photo(page, o.label)).toHaveAttribute("src", o.image);
    await expect.poll(() => photo(page, o.label).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  }
}

/** 画面に見えている文字のうち正解情報にあたるもの（埋め込みデータの <script> は innerText に入らない） */
function visibleAnswerInfo(page: Page) {
  return page.evaluate(
    ({ secrets }) => {
      const text = document.body.innerText;
      return [...secrets, "正解", "1位", "2位", "3位"].filter((s) => text.includes(s));
    },
    { secrets },
  );
}

/** 要素の中心に別の要素（下に留めたボタンなど）が重なっていない */
function isUncovered(el: Element) {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return hit !== null && el.contains(hit);
}

async function goTo(page: Page, index: number) {
  for (let i = 1; i <= index; i++) {
    await nextButton(page).click();
    await expectQuestion(page, i);
  }
}

test.describe("問題の表示", () => {
  test("開いた直後は第 1 問を表示する", async ({ page }) => {
    await openGuest(page);
  });

  test("3 択の問題で 3 つの選択肢を表示する", async ({ page }) => {
    await openGuest(page);
    await goTo(page, THREE_OPTIONS);
    for (const label of ["A", "B", "C"]) {
      await expect(labelBar(page, label)).toBeVisible();
      await expect(photo(page, label)).toBeVisible();
    }
  });
});

test.describe("前後の問題への移動", () => {
  test("次へで次の問題を表示する", async ({ page }) => {
    await openGuest(page);
    await nextButton(page).click();
    await expectQuestion(page, 1);
  });

  test("前へで前の問題を表示する", async ({ page }) => {
    await openGuest(page);
    await goTo(page, 1);
    await prevButton(page).click();
    await expectQuestion(page, 0);
  });

  test("第 1 問では前へを操作できない", async ({ page }) => {
    await openGuest(page);
    await expect(prevButton(page)).toBeDisabled();
    await prevButton(page).click({ force: true });
    await expectQuestion(page, 0);
  });

  test("最終問では次へを操作できない", async ({ page }) => {
    await openGuest(page);
    await goTo(page, last);
    await expect(nextButton(page)).toBeDisabled();
    await nextButton(page).click({ force: true });
    await expectQuestion(page, last);
  });
});

test.describe("正解情報を表示しない", () => {
  test("どの問題でも正解情報が表示されない", async ({ page }) => {
    expect(secrets.length).toBeGreaterThan(0);
    await openGuest(page);
    expect(await visibleAnswerInfo(page), "第 1 問で見えている正解情報").toEqual([]);
    for (let i = 1; i <= last; i++) {
      await nextButton(page).click();
      await expectQuestion(page, i);
      expect(await visibleAnswerInfo(page), `第 ${i + 1} 問で見えている正解情報`).toEqual([]);
    }
    await expect(nextButton(page)).toBeDisabled();
  });

  test("正解発表の操作がない", async ({ page }) => {
    await openGuest(page);
    await expect(page.getByRole("button", { name: "正解発表" })).toHaveCount(0);
    await expect(page.locator(":focus")).toHaveCount(0);
    for (const key of ["Space", "Enter"]) {
      await page.keyboard.press(key);
      await expectQuestion(page, 0);
      expect(await visibleAnswerInfo(page), `${key} を押した後に見えている正解情報`).toEqual([]);
    }
  });
});

test.describe("スマホでの表示", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("幅 360px で横スクロールが発生しない", async ({ page }) => {
    await openGuest(page);
    await goTo(page, THREE_OPTIONS);
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(360);
    expect(width.scroll).toBeLessThanOrEqual(width.client);
    for (const label of ["A", "B", "C"]) {
      for (const target of [photo(page, label), labelBar(page, label)]) {
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport({ ratio: 1 });
        expect(await target.evaluate(isUncovered), "下に留めたボタンに隠れていない").toBe(true);
      }
    }
  });
});
