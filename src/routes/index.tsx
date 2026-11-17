import { createFileRoute } from "@tanstack/react-router";
import publicSet from "virtual:kakuzuke/public";
import { LEAK_CANARY } from "../guest/leak-canary.ts";
import { OptionCard } from "../ui/OptionCard.tsx";

export const Route = createFileRoute("/")({
  component: () => (
    <main data-leak-canary={LEAK_CANARY}>
      <p>参加者画面（仮）</p>
      {publicSet.map((q, i) => (
        <section key={i}>
          <h2>{q.title}</h2>
          {q.options.map((o) => (
            <OptionCard key={o.label} label={o.label} image={o.image} />
          ))}
        </section>
      ))}
    </main>
  ),
});
