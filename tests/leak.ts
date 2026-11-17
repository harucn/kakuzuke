export interface SecretHit {
  readonly secret: string;
  /** 正規化した後の文字列での位置 */
  readonly index: number;
  /** 正規化した後の前後の文字 */
  readonly context: string;
}

const CONTEXT_CHARS = 20;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const SINGLE_ESCAPES: Readonly<Record<string, string>> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  v: "\v",
  0: "\0",
};

// JS のエスケープと HTML の実体参照を 1 回の走査で戻す。種類ごとに順に置き換えると、\\u6F0F（\ そのものと u6F0F）を 2 回復号してしまう
const ENCODED =
  /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))|&(?:#[xX]([0-9a-fA-F]+);?|#([0-9]+);?|([a-zA-Z][a-zA-Z0-9]*);)/g;

function codePoint(value: number, original: string): string {
  return value <= 0x10ffff ? String.fromCodePoint(value) : original;
}

function decode(match: string, ...groups: (string | undefined)[]): string {
  const [braced, unicode, hex, escaped, entityHex, entityDecimal, entityName] = groups;
  if (braced !== undefined) return codePoint(parseInt(braced, 16), match);
  if (unicode !== undefined) return String.fromCharCode(parseInt(unicode, 16));
  if (hex !== undefined) return String.fromCharCode(parseInt(hex, 16));
  if (escaped !== undefined) return SINGLE_ESCAPES[escaped] ?? escaped;
  if (entityHex !== undefined) return codePoint(parseInt(entityHex, 16), match);
  if (entityDecimal !== undefined) return codePoint(parseInt(entityDecimal, 10), match);
  return NAMED_ENTITIES[entityName!] ?? match;
}

/**
 * JS の文字列リテラルや HTML に書かれた文字を元の文字に戻す。漏洩の検出は必ずこの結果に対して行う。
 * HTML の地の文の \ もエスケープとして読むので、末尾が \ の秘密や、\ の直後が実体参照になる秘密は HTML の中では一致しない
 */
export function normalize(text: string): string {
  return text.replace(ENCODED, decode).normalize("NFC");
}

/** 実体参照やエスケープに見える並び（"&amp;" や "\n"）を含む秘密も見つかるよう、そのままの形と復号した形の両方で探す */
export function findSecrets(text: string, secrets: readonly string[]): SecretHit[] {
  const haystack = normalize(text);
  const hits: SecretHit[] = [];
  for (const secret of secrets) {
    for (const needle of new Set([secret.normalize("NFC"), normalize(secret)])) {
      for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
        hits.push({
          secret,
          index,
          context: haystack.slice(Math.max(0, index - CONTEXT_CHARS), index + needle.length + CONTEXT_CHARS),
        });
      }
    }
  }
  return hits;
}
