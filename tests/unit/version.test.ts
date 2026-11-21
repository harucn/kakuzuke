import { describe, expect, it } from "vitest";
import { toPublic, type Question, type QuestionSet } from "../../src/question-set/model.ts";
import { versionOf } from "../../src/question-set/vite-plugin.ts";
import { questionSet, venueSet } from "./fixtures.ts";

function withFirstQuestion(change: (q: Question) => Question): QuestionSet {
  const [first, ...rest] = venueSet.questions;
  return questionSet(venueSet.title, change(first), ...rest);
}

const versions = (set: QuestionSet) => ({ public: versionOf(toPublic(set)), answers: versionOf(set) });

describe("問題セットの版", () => {
  const base = versions(venueSet);

  it("公開項目を変えると公開形と正解込みの両方の版が変わる", () => {
    const changed = versions(withFirstQuestion((q) => ({ ...q, title: "別の題" })));
    expect(changed.public).not.toBe(base.public);
    expect(changed.answers).not.toBe(base.answers);
  });

  it("正解だけを変えると正解込みの版だけが変わり、公開形の版は変わらない", () => {
    const swapped = withFirstQuestion((q) => ({
      ...q,
      options: [
        { ...q.options[0], rank: q.options[1].rank },
        { ...q.options[1], rank: q.options[0].rank },
      ],
    }));
    const renamed = withFirstQuestion((q) => ({ ...q, explanation: "別の解説" }));
    for (const set of [swapped, renamed]) {
      const changed = versions(set);
      expect(changed.public).toBe(base.public);
      expect(changed.answers).not.toBe(base.answers);
    }
  });

  it("同じ問題セットからは同じ版を作る", () => {
    expect(versions(structuredClone(venueSet))).toEqual(base);
  });
});
