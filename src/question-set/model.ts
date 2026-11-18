export type Mode = "pick" | "order";
export type Label = "A" | "B" | "C";
export type Rank = 1 | 2 | 3;
/** 公開 URL（例 "/images/3f9a2c41.jpg"）。中身のハッシュから作り、元のファイル名を含まない。問題コンパイラ（vite-plugin.ts）だけが作れる */
export type ImageUrl = string & { readonly __brand: "ImageUrl" };

export interface Option {
  /** 作者が書く。表示順とは無関係 */
  readonly label: Label;
  readonly image: ImageUrl;
  /** 選択肢の説明 */
  readonly note: string;
  /** 1 = 最も高価。正解の唯一の情報源 */
  readonly rank: Rank;
  readonly name: string;
  /** 表示用の文字列。比較しない */
  readonly price: string;
}
/** 表示順 */
export type Options = readonly [Option, Option] | readonly [Option, Option, Option];

export interface Question {
  readonly mode: Mode;
  readonly title: string;
  readonly description: string;
  readonly explanation: string;
  readonly options: Options;
}
/** 検証済み。問題は 1 問以上・出題順。parseQuestionSet だけが作れる */
export type QuestionSet = {
  /** 会のタイトル。参加者にも見える */
  readonly title: string;
  readonly questions: readonly [Question, ...Question[]];
} & { readonly __brand: "QuestionSet" };

/** 司会画面の loader の値。ブランドは createServerFn の直列化の型検査を通らないので持たない */
export type HostQuestionSet = Omit<QuestionSet, "__brand">;

export type PublicOption = Pick<Option, "image" | "note">;
export type PublicQuestion = Pick<Question, "mode" | "title" | "description"> & {
  readonly options: readonly [PublicOption, PublicOption] | readonly [PublicOption, PublicOption, PublicOption];
};
export type PublicQuestionSet = {
  readonly title: string;
  readonly questions: readonly [PublicQuestion, ...PublicQuestion[]];
};

export const PUBLIC_SET_KEYS = ["title", "questions"] as const;
export const PUBLIC_QUESTION_KEYS = ["mode", "title", "description", "options"] as const;
export const PUBLIC_OPTION_KEYS = ["image", "note"] as const;

function toPublicOption(o: Option): PublicOption {
  return { image: o.image, note: o.note };
}

function toPublicQuestion(q: Question): PublicQuestion {
  const o = q.options;
  return {
    mode: q.mode,
    title: q.title,
    description: q.description,
    options:
      o.length === 2
        ? [toPublicOption(o[0]), toPublicOption(o[1])]
        : [toPublicOption(o[0]), toPublicOption(o[1]), toPublicOption(o[2])],
  };
}

/** 許可リスト方式の射影。spread も omit も使わず項目ごとに新しいオブジェクトを作るので、後から足した項目は既定で非公開になる */
export function toPublic(set: QuestionSet): PublicQuestionSet {
  const [first, ...rest] = set.questions;
  return { title: set.title, questions: [toPublicQuestion(first), ...rest.map(toPublicQuestion)] };
}

export type Answer =
  | { readonly mode: "pick"; readonly winner: Label }
  | { readonly mode: "order"; readonly sequence: readonly Label[] };

export function answerOf(q: Question): Answer {
  const ranked = [...q.options].sort((a, b) => a.rank - b.rank);
  switch (q.mode) {
    case "pick":
      return { mode: "pick", winner: ranked[0].label };
    case "order":
      return { mode: "order", sequence: ranked.map((o) => o.label) };
  }
}

export type SecretKind = "name" | "price" | "explanation";

/** 秘密の項目の唯一の定義。T は検証前の値（unknown）でも検証済みの string でもよい */
export function secretFields<T>(q: {
  readonly explanation: T;
  readonly options: readonly { readonly name: T; readonly price: T }[];
}): readonly { readonly kind: SecretKind; readonly value: T }[] {
  return [
    ...q.options.flatMap((o) => [
      { kind: "name" as const, value: o.name },
      { kind: "price" as const, value: o.price },
    ]),
    { kind: "explanation", value: q.explanation },
  ];
}

/** 漏洩とみなす文字列: 全選択肢の name と price、全問題の explanation（重複は除く）。rank は数値なので構造で検査する */
export function secretStrings(set: QuestionSet): readonly string[] {
  return [...new Set(set.questions.flatMap((q) => secretFields(q).map((f) => f.value)))];
}
