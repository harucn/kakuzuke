import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../../src/host/restore.ts";
import { answerOf, secretStrings, type Answer, type Label } from "../../src/question-set/model.ts";
import { loadQuestionSet } from "../../src/question-set/vite-plugin.ts";

// package.json の e2e がこのフィクスチャでビルドした dist に対して流す
const set = loadQuestionSet(path.resolve(import.meta.dirname, "../.."), { contentDir: "tests/fixtures/content" });
const { questions } = set;
const secrets = secretStrings(set);
const last = questions.length - 1;

const prevButton = (page: Page) => page.getByRole("button", { name: "前へ" });
const nextButton = (page: Page) => page.getByRole("button", { name: "次へ" });
const revealButton = (page: Page) => page.getByRole("button", { name: "正解発表" });
const fullscreenButton = (page: Page) => page.getByRole("button", { name: "全画面" });
const card = (page: Page, label: Label) => page.locator(`.option-card[data-label="${label}"]`);
const stamp = (page: Page) => page.getByTestId("stamp");
const celebration = (page: Page) => page.getByTestId("celebration");
const PICK = 0;
const ORDER = 1;

/** フィクスチャの前提（第 1 問は pick、第 2 問は 3 択の order）が崩れたら全体を止める */
function answerAt<M extends "pick" | "order">(index: number, mode: M) {
  const answer = answerOf(questions[index]);
  if (answer.mode !== mode) throw new Error(`フィクスチャの第 ${index + 1} 問は ${mode} の前提`);
  return answer as Extract<Answer, { mode: M }>;
}

/** 第 index + 1 問の問題名・説明・全選択肢・番号が表示されている */
async function expectQuestion(page: Page, index: number) {
  const q = questions[index];
  await expect(page.getByRole("heading", { level: 1 })).toContainText(q.title);
  await expect(page.getByText(`${index + 1} / ${questions.length}`)).toBeVisible();
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
    await expect.poll(() => visibleAnswerInfo(page)).toEqual(expect.arrayContaining(["正解は", questions[last].explanation]));
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
    await expect(page.getByText(questions[0].explanation)).toBeVisible();
    await nextButton(page).click();
    await expectAsking(page, 1);
    await prevButton(page).click();
    await expectAsking(page, 0);
  });
});

test.describe("再読み込みで同じ問題に戻る", () => {
  test("第 3 問で再読み込みすると第 3 問に戻る", async ({ page }) => {
    await openHost(page);
    await goTo(page, 2);
    await page.reload();
    await expectAsking(page, 2);
  });

  test("正解発表後に再読み込みすると発表前の状態に戻る", async ({ page }) => {
    await openHost(page);
    await goTo(page, 1);
    await revealButton(page).click();
    await expect(page.getByText(questions[1].explanation)).toBeVisible();
    await page.reload();
    await expectAsking(page, 1);
  });

  test("問題数が減った後の再読み込みでは範囲内の問題を表示する", async ({ page }) => {
    await openHost(page);
    // 問題数が減ったセットのデプロイは、保存された位置が今の問題数を超えている状態として作る
    await page.evaluate((key) => sessionStorage.setItem(key, "99"), STORAGE_KEY);
    await page.reload();
    await expectAsking(page, last);
  });
});

const isFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

test.describe("全画面表示", () => {
  test("全画面ボタンで全画面表示になる", async ({ page }) => {
    await openHost(page);
    await fullscreenButton(page).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await expect(fullscreenButton(page)).toHaveAttribute("aria-pressed", "true");
    await expectAsking(page, 0);
  });

  test("全画面表示中に全画面ボタンで元に戻る", async ({ page }) => {
    await openHost(page);
    await fullscreenButton(page).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await fullscreenButton(page).click();
    await expect.poll(() => isFullscreen(page)).toBe(false);
    await expect(fullscreenButton(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("全画面表示が拒否されても操作を続けられる", async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (e) => errors.push(e));
    await page.addInitScript(() => {
      const w = window as typeof window & { fullscreenRequests: number };
      w.fullscreenRequests = 0;
      Element.prototype.requestFullscreen = () => {
        w.fullscreenRequests++;
        return Promise.reject(new Error("denied"));
      };
    });
    await openHost(page);
    await fullscreenButton(page).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { fullscreenRequests: number }).fullscreenRequests)).toBe(1);
    expect(await isFullscreen(page)).toBe(false);
    await nextButton(page).click();
    await expectAsking(page, 1);
    await prevButton(page).click();
    await expectAsking(page, 0);
    await revealButton(page).click();
    await expect(page.getByText(questions[0].explanation)).toBeVisible();
    expect(errors).toEqual([]);
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
      await expect(page.getByText(questions[0].explanation)).toBeVisible();
    });
  }
});

/** 第 index + 1 問を開いて正解発表を 1 回押し、正解の印が出るまで待つ */
async function revealAt(page: Page, index: number) {
  await openHost(page);
  await goTo(page, index);
  await revealButton(page).click();
  await expect(stamp(page)).toBeVisible();
}

/** 印は rank 1 の選択肢にだけ付く */
async function expectStampOnlyOn(page: Page, index: number, winner: Label) {
  await expect(stamp(page)).toHaveCount(1);
  await expect(card(page, winner).getByTestId("stamp")).toHaveText("正解！");
  for (const o of questions[index].options.filter((o) => o.label !== winner)) {
    await expect(card(page, o.label).getByTestId("stamp")).toHaveCount(0);
  }
}

/** 紙吹雪の canvas に色の付いたドットがある */
function celebrationHasDots(page: Page) {
  return celebration(page).evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    return data.some((v, i) => i % 4 === 3 && v > 0);
  });
}

test.describe("pick の正解発表", () => {
  const q = questions[PICK];
  const { winner } = answerAt(PICK, "pick");

  test("pick で正解の選択肢に正解の印が付く", async ({ page }) => {
    await revealAt(page, PICK);
    await expectStampOnlyOn(page, PICK, winner);
  });

  test("pick の正解発表で全選択肢の銘柄と価格を表示する", async ({ page }) => {
    await revealAt(page, PICK);
    for (const o of q.options) {
      await expect(card(page, o.label)).toContainText(o.name);
      await expect(card(page, o.label)).toContainText(o.price);
    }
  });

  test("pick の正解発表で正解ラベルと解説を表示する", async ({ page }) => {
    await revealAt(page, PICK);
    await expect(page.getByText(`正解は ${winner}`)).toBeVisible();
    await expect(page.getByText(q.explanation)).toBeVisible();
  });
});

test.describe("order の正解発表", () => {
  const q = questions[ORDER];
  const { sequence } = answerAt(ORDER, "order");

  test("order の正解発表で全選択肢に順位を表示する", async ({ page }) => {
    await revealAt(page, ORDER);
    for (const o of q.options) {
      await expect(card(page, o.label)).toContainText(`${o.rank}位`);
      await expect(card(page, o.label)).toContainText(o.name);
      await expect(card(page, o.label)).toContainText(o.price);
    }
  });

  test("order の正解発表で 1 位の選択肢に正解の印が付く", async ({ page }) => {
    await revealAt(page, ORDER);
    await expectStampOnlyOn(page, ORDER, sequence[0]);
  });

  test("order の正解発表で正解の並びと解説を表示する", async ({ page }) => {
    await revealAt(page, ORDER);
    await expect(page.getByText(`正解は ${sequence.join(" → ")}`)).toBeVisible();
    await expect(page.getByText(q.explanation)).toBeVisible();
  });
});

test.describe("正解発表の再演出", () => {
  test("正解発表をもう一度押すと演出を再生する", async ({ page }) => {
    await revealAt(page, PICK);
    await expect.poll(() => celebrationHasDots(page)).toBe(true);
    const first = [await stamp(page).elementHandle(), await celebration(page).elementHandle()];
    await revealButton(page).click();
    for (const old of first) {
      await expect.poll(() => old!.evaluate((el) => el.isConnected)).toBe(false);
    }
    await expect(stamp(page)).toHaveCount(1);
    await expect(celebration(page)).toHaveCount(1);
    await expect.poll(() => stamp(page).evaluate((el) => getComputedStyle(el).animationName)).not.toBe("none");
    await expect.poll(() => celebrationHasDots(page)).toBe(true);
  });

  test("正解発表をもう一度押しても正解情報は変わらない", async ({ page }) => {
    await revealAt(page, ORDER);
    const shown = () =>
      Promise.all([
        page.locator(".host-opts").innerText(),
        page.locator(".msg").innerText(),
        stamp(page).evaluate((el) => el.closest("[data-label]")?.getAttribute("data-label")),
      ]);
    const before = await shown();
    const firstStamp = await stamp(page).elementHandle();
    await revealButton(page).click();
    await expect.poll(() => firstStamp!.evaluate((el) => el.isConnected)).toBe(false);
    await expect(stamp(page)).toBeVisible();
    expect(await shown()).toEqual(before);
  });

  test("reduced motion が有効なときは演出を再生しない", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await revealAt(page, PICK);
    const q = questions[PICK];
    await expect(page.getByText(q.explanation)).toBeVisible();
    for (const o of q.options) await expect(card(page, o.label)).toContainText(o.name);
    await expect(celebration(page)).toHaveCount(0);
    expect(await stamp(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});
