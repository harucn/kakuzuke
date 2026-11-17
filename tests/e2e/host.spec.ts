import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { secretStrings } from "../../src/question-set/model.ts";
import { loadQuestionSet } from "../../src/question-set/vite-plugin.ts";

// package.json の e2e がこのフィクスチャでビルドした dist に対して流す
const set = loadQuestionSet(path.resolve(import.meta.dirname, "../.."), { contentDir: "tests/fixtures/content" });
const secrets = secretStrings(set);
const last = set.length - 1;

const prevButton = (page: Page) => page.getByRole("button", { name: "前へ" });
const nextButton = (page: Page) => page.getByRole("button", { name: "次へ" });

/** 第 index + 1 問の問題名・説明・全選択肢・番号が表示されている */
async function expectQuestion(page: Page, index: number) {
  const q = set[index];
  await expect(page.getByRole("heading", { level: 1 })).toContainText(q.title);
  await expect(page.getByText(`${index + 1} / ${set.length}`)).toBeVisible();
  await expect(page.getByText(q.description)).toBeVisible();
  await expect(page.getByRole("img", { name: /^選択肢 / })).toHaveCount(q.options.length);
  for (const o of q.options) {
    await expect(page.getByText(o.label, { exact: true })).toBeVisible();
    const photo = page.getByRole("img", { name: `選択肢 ${o.label}` });
    await expect(photo).toHaveAttribute("src", o.image);
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  }
}

/** 画面に見えている文字（埋め込みデータの <script> は innerText に入らない） */
function visibleAnswerInfo(page: Page) {
  return page.evaluate(
    ({ secrets }) => {
      const text = document.body.innerText;
      return [...secrets, "正解は", "正解！", "1位", "2位", "3位"].filter((s) => text.includes(s));
    },
    { secrets },
  );
}

/** 第 index + 1 問が正解発表前の状態で表示されている */
async function expectAsking(page: Page, index: number) {
  await expectQuestion(page, index);
  expect(await visibleAnswerInfo(page), "正解発表前に見えている正解情報").toEqual([]);
}

async function openHost(page: Page) {
  await page.goto("/host");
  await expectAsking(page, 0);
}

async function goTo(page: Page, index: number) {
  for (let i = 1; i <= index; i++) {
    await nextButton(page).click();
    await expectQuestion(page, i);
  }
}

test.describe("問題の表示", () => {
  test("新しいタブで開いた直後は第 1 問を表示する", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const page = await context.newPage();
    await page.goto("/host");
    await expectQuestion(page, 0);
    await context.close();
  });

  test("正解発表前は正解情報を表示しない", async ({ page }) => {
    await openHost(page);
    for (let i = 1; i <= last; i++) {
      await nextButton(page).click();
      await expectAsking(page, i);
    }
    // 陽性対照: 正解発表すれば同じ検査が正解情報を見つける
    await page.keyboard.press("Enter");
    await expect.poll(() => visibleAnswerInfo(page)).toEqual(expect.arrayContaining(["正解は", set[last].explanation]));
  });
});

test.describe("前後の問題への移動", () => {
  test("次へで次の問題を表示する", async ({ page }) => {
    await openHost(page);
    await nextButton(page).click();
    await expectAsking(page, 1);
  });

  test("前へで前の問題を表示する", async ({ page }) => {
    await openHost(page);
    await goTo(page, 1);
    await prevButton(page).click();
    await expectAsking(page, 0);
  });

  test("第 1 問では前へを操作できない", async ({ page }) => {
    await openHost(page);
    await expect(prevButton(page)).toBeDisabled();
    await prevButton(page).click({ force: true });
    await expectAsking(page, 0);
  });

  test("最終問では次へを操作できない", async ({ page }) => {
    await openHost(page);
    await goTo(page, last);
    await expect(nextButton(page)).toBeDisabled();
    await nextButton(page).click({ force: true });
    await expectAsking(page, last);
  });

  test("正解発表後に移動して戻ると発表前に戻る", async ({ page }) => {
    await openHost(page);
    await page.keyboard.press("Space");
    await expect(page.getByText(set[0].explanation)).toBeVisible();
    await nextButton(page).click();
    await expectAsking(page, 1);
    await prevButton(page).click();
    await expectAsking(page, 0);
  });
});

test.describe("キーボード操作", () => {
  for (const key of ["ArrowRight", "PageDown"]) {
    const name = key === "ArrowRight" ? "→" : key;
    test(`${name} キーで次の問題へ進む`, async ({ page }) => {
      await openHost(page);
      await page.keyboard.press(key);
      await expectAsking(page, 1);
    });
  }

  for (const key of ["ArrowLeft", "PageUp"]) {
    const name = key === "ArrowLeft" ? "←" : key;
    test(`${name} キーで前の問題へ戻る`, async ({ page }) => {
      await openHost(page);
      await goTo(page, 1);
      await page.keyboard.press(key);
      await expectAsking(page, 0);
    });
  }

  for (const key of ["Space", "Enter"]) {
    test(`${key} キーで正解発表する`, async ({ page }) => {
      await openHost(page);
      await page.keyboard.press(key);
      // 第 1 問は B が rank 1 の pick（フィクスチャの前提）
      await expect(page.getByText("正解は B")).toBeVisible();
      await expect(page.getByText(set[0].explanation)).toBeVisible();
    });
  }
});
