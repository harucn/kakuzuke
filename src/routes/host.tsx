import { createFileRoute } from "@tanstack/react-router";
import { positionText } from "../deck/cursor.ts";
import { getHostQuestionSet } from "../host/host-data.functions.ts";

export const Route = createFileRoute("/host")({
  loader: () => getHostQuestionSet(),
  staleTime: Infinity,
  component: HostPlaceholder,
});

function HostPlaceholder() {
  const set = Route.useLoaderData();
  return (
    <main>
      <p>司会画面（仮）</p>
      <ol>
        {set.map((q, i) => (
          <li key={i}>
            {positionText(i, set.length)} {q.title}
          </li>
        ))}
      </ol>
    </main>
  );
}
