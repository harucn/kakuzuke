import type { Mode, PublicOption } from "../question-set/model.ts";
import type { RevealedOption } from "../venue/protocol.ts";
import { OptionCard } from "./OptionCard.tsx";

/** 正解発表後の選択肢。option と revealed は同じ表示位置のもの */
export function RevealedCard({
  option,
  revealed,
  mode,
  size,
  celebration,
}: {
  readonly option: PublicOption;
  readonly revealed: RevealedOption;
  readonly mode: Mode;
  readonly size: "host" | "guest";
  /** 演出の key。null（つないだ直後の正解発表）では印を点滅させない */
  readonly celebration: string | null;
}) {
  // pick は外れを薄くする。order は全選択肢の順位を読ませたいので薄くしない
  const tone = revealed.correct ? "correct" : mode === "pick" ? "dim" : undefined;
  return (
    <OptionCard size={size} image={option.image} note={option.note} label={revealed.label} tone={tone}>
      <div className="tag">
        {revealed.rank !== null && <b>{revealed.rank}位</b>}
        {revealed.name}
        <br />
        {revealed.price}
      </div>
      {revealed.correct && (
        // 点滅は CSS（reduced motion では止まる）。key を変えて作り直すと最初から点滅する
        <div key={celebration} className={`stamp${celebration === null ? "" : " stamp--blink"}`} data-testid="stamp">
          正解！
        </div>
      )}
    </OptionCard>
  );
}
