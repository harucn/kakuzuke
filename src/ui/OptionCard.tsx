import type { ReactNode } from "react";
import type { ImageUrl, Label } from "../question-set/model.ts";

/** 行の構成（写真・選択肢の説明）はラベルの有無で変わらない。ラベルは写真に重ねるので、正解発表の前後で写真の座標と大きさが同じになる */
export function OptionCard({
  image,
  note,
  label,
  children,
  size = "guest",
  tone,
}: {
  readonly image: ImageUrl;
  readonly note: string;
  /** 正解発表後の司会画面だけが渡す */
  readonly label?: Label;
  /** 写真の上に重ねるもの（司会画面の銘柄・価格や「正解！」の印） */
  readonly children?: ReactNode;
  readonly size?: "host" | "guest";
  /** 正解発表後の見た目。correct は枠とラベルが赤、dim は薄く */
  readonly tone?: "correct" | "dim";
}) {
  const className = `option-card option-card--${size}${tone === undefined ? "" : ` option-card--${tone}`} px`;
  return (
    <div className={className} data-label={label}>
      <div className="option-card__media">
        <img className="option-card__photo" src={image} alt="" />
        {label !== undefined && <div className="label-bar">{label}</div>}
      </div>
      <p className="option-note">{note}</p>
      {children}
    </div>
  );
}
