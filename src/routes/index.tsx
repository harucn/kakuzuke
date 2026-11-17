import { createFileRoute } from "@tanstack/react-router";
import publicSet from "virtual:kakuzuke/public";

export const Route = createFileRoute("/")({
  component: () => (
    <main>
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
