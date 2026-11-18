import { encode } from "uqr";

/**
 * 暗いモジュールを 1 本の path で描く。色はテーマ（theme.css の .qr）で塗る。
 * 周りの 4 モジュールは読み取りに要る余白（quiet zone）。誤り訂正は投影のにじみに備えて M にする
 */
export function QrCode({ value, label }: { readonly value: string; readonly label: string }) {
  const { size, data } = encode(value, { ecc: "M", border: 4 });
  const d = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  return (
    <svg className="qr" role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      <path d={d} />
    </svg>
  );
}
