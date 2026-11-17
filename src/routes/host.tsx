import { createFileRoute } from "@tanstack/react-router";
import { HostScreen } from "../host/HostScreen.tsx";
import { getHostQuestionSet } from "../host/host-data.functions.ts";

export const Route = createFileRoute("/host")({
  loader: () => getHostQuestionSet(),
  staleTime: Infinity,
  component: () => <HostScreen set={Route.useLoaderData()} />,
});
