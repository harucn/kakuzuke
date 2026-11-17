import type { ReactNode } from "react";
import type { ImageUrl, Label } from "../question-set/model.ts";

export function OptionCard({
  label,
  image,
  children,
  size = "guest",
}: {
  readonly label: Label;
  readonly image: ImageUrl;
  /** 写真の上に重ねるもの（司会画面の銘柄・価格や「正解！」の印） */
  readonly children?: ReactNode;
  readonly size?: "host" | "guest";
}) {
  return (
    <div className={`option-card option-card--${size} px`} data-label={label}>
      <img className="option-card__photo" src={image} alt={`選択肢 ${label}`} />
      <div className="label-bar">{label}</div>
      {children}
    </div>
  );
}
