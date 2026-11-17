import { createFileRoute } from "@tanstack/react-router";
import publicSet from "virtual:kakuzuke/public";
import { LEAK_CANARY } from "../guest/leak-canary.ts";

export const Route = createFileRoute("/")({
  component: () => (
    <main data-leak-canary={LEAK_CANARY}>
      <p>参加者画面（仮）</p>
      {publicSet.map((q, i) => (
        <section key={i}>
          <h2>{q.title}</h2>
          {q.options.map((o) => (
            <img key={o.label} src={o.image} alt={o.label} width={160} />
          ))}
        </section>
      ))}
    </main>
  ),
});
