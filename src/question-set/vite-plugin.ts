import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { parse as parseYaml } from "yaml";
import { toPublic, type ImageUrl, type QuestionSet } from "./model.ts";
import { formatIssues, parseQuestionSet } from "./parse.ts";

export interface KakuzukeOptions {
  /** 既定 "content"。環境変数 KAKUZUKE_CONTENT_DIR が優先する（E2E のフィクスチャ用） */
  readonly contentDir?: string;
  /** 既定 "<contentDir>/images"。public/ の外に置き、Vite がそのまま公開しないようにする */
  readonly imagesDir?: string;
  /** 既定 "ssr"。正解を読める唯一の環境 */
  readonly serverEnvironment?: string;
}

const PUBLIC_ID = "virtual:kakuzuke/public";
const ANSWERS_ID = "virtual:kakuzuke/answers";
const RESOLVED_IDS = [`\0${PUBLIC_ID}`, `\0${ANSWERS_ID}`];

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

interface ContentFiles {
  readonly questions: string;
  readonly images: string;
  /** エラーの見出しに出す問題ファイルの名前 */
  readonly label: string;
}

type Compiled =
  | {
      readonly ok: true;
      readonly set: QuestionSet;
      /** 指定された写真だけ。公開 URL → 元ファイルの絶対パス */
      readonly published: ReadonlyMap<ImageUrl, string>;
    }
  | { readonly ok: false; readonly message: string };

function locate(root: string, options: KakuzukeOptions): ContentFiles {
  const contentDir = path.resolve(root, process.env.KAKUZUKE_CONTENT_DIR ?? options.contentDir ?? "content");
  const questions = path.join(contentDir, "questions.yaml");
  const relative = path.relative(root, questions);
  return {
    questions,
    images: options.imagesDir === undefined ? path.join(contentDir, "images") : path.resolve(root, options.imagesDir),
    label: relative.startsWith("..") ? questions : relative,
  };
}

/** 元のファイル名 → 公開 URL と元ファイル。公開名は中身のハッシュなので、中身が同じファイルは同じ URL になる */
function scanImages(dir: string): ReadonlyMap<string, { readonly url: ImageUrl; readonly file: string }> {
  if (!existsSync(dir)) return new Map();
  return new Map(
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = path.join(dir, entry.name);
        const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
        const url = `/images/${hash}${path.extname(entry.name).toLowerCase()}` as ImageUrl;
        // macOS は濁点を分解した名前を返すことがあり、YAML に書いた名前と一致しなくなる
        return [entry.name.normalize("NFC"), { url, file }] as const;
      }),
  );
}

function compile(files: ContentFiles): Compiled {
  let input: unknown;
  let sources: ReturnType<typeof scanImages>;
  try {
    input = parseYaml(readFileSync(files.questions, "utf8"));
    sources = scanImages(files.images);
  } catch (error) {
    return { ok: false, message: `✗ ${files.label}\n  ${error instanceof Error ? error.message : String(error)}` };
  }
  const result = parseQuestionSet(input, new Map([...sources].map(([name, source]) => [name, source.url])));
  if (!result.ok) return { ok: false, message: `✗ ${files.label}\n${formatIssues(result.issues)}` };

  const fileOf = new Map([...sources.values()].map((source) => [source.url, source.file]));
  const published = new Map(result.set.questions.flatMap((q) => q.options.map((o) => [o.image, fileOf.get(o.image)!] as const)));
  return { ok: true, set: result.set, published };
}

/** 問題セットの版。JSON の SHA-256 なので、どの項目を変えても変わる */
export function versionOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** テストが実データを読む唯一の入口。プラグインと同じ場所・同じ検証を使う */
export function loadQuestionSet(root: string, options: KakuzukeOptions = {}): QuestionSet {
  const compiled = compile(locate(root, options));
  if (!compiled.ok) throw new Error(compiled.message);
  return compiled.set;
}

export function kakuzukeQuestions(options: KakuzukeOptions = {}): Plugin {
  const serverEnvironment = options.serverEnvironment ?? "ssr";
  let files: ContentFiles;
  // build では環境ごとに別のインスタンスになり、dev の buildStart は client でしか呼ばれないので、最初に使うフックが作る
  let compiled: Compiled | undefined;
  const current = () => (compiled ??= compile(files));

  function moduleOf(project: (set: QuestionSet) => unknown): string {
    const c = current();
    if (!c.ok) throw new Error(c.message);
    const value = project(c.set);
    return `export default ${JSON.stringify(value)};\nexport const version = ${JSON.stringify(versionOf(value))};`;
  }

  return {
    name: "kakuzuke-questions",
    enforce: "pre",

    configResolved(config) {
      files = locate(config.root, options);
    },

    buildStart() {
      const c = current();
      if (!c.ok && this.environment.mode === "build") this.error(c.message);
    },

    resolveId(id) {
      if (id === PUBLIC_ID || id === ANSWERS_ID) return `\0${id}`;
    },

    load(id) {
      if (id === `\0${PUBLIC_ID}`) return moduleOf(toPublic);
      const onServer = this.environment.name === serverEnvironment;
      if (id === `\0${ANSWERS_ID}`) {
        if (!onServer) this.error(`${ANSWERS_ID} はサーバー側でしか読み込めません`);
        return moduleOf((set) => set);
      }
      if (!onServer && path.resolve(id.split("?")[0]) === files.questions) {
        this.error(`${files.label} はサーバー側でしか読み込めません`);
      }
    },

    generateBundle() {
      if (this.environment.name !== "client") return;
      const c = current();
      if (!c.ok) return;
      for (const [url, file] of c.published) {
        this.emitFile({ type: "asset", fileName: url.slice(1), source: readFileSync(file) });
      }
    },

    configureServer(server) {
      const isContent = (file: string) =>
        file === files.questions || file === files.images || file.startsWith(files.images + path.sep);
      server.watcher.add([files.questions, files.images]);
      server.watcher.on("all", (_event, file) => {
        if (!isContent(file)) return;
        compiled = compile(files);
        for (const environment of Object.values(server.environments)) {
          for (const id of RESOLVED_IDS) {
            const mod = environment.moduleGraph.getModuleById(id);
            if (mod) environment.moduleGraph.invalidateModule(mod);
          }
          // triggeredBy を付けない。問題ファイルはモジュールではないので、付けるとサーバー側のランナーが再読み込みを見送る
          environment.hot.send({ type: "full-reload" });
        }
      });

      server.middlewares.use((req, res, next) => {
        const c = current();
        const url = req.url?.split("?")[0] as ImageUrl | undefined;
        const file = c.ok && url !== undefined ? c.published.get(url) : undefined;
        if (file === undefined) return next();
        res.setHeader("Content-Type", CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
        res.end(readFileSync(file));
      });
    },
  };
}
