import { createFileRoute } from "@tanstack/react-router";
import publicSet from "virtual:kakuzuke/public";
import { HostScreen } from "../host/HostScreen.tsx";

export const Route = createFileRoute("/host")({
  component: () => <HostScreen set={publicSet} />,
});
