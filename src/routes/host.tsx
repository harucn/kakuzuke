import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/host")({
  component: () => <p>司会画面（仮）</p>,
});
