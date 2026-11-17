import { createFileRoute } from "@tanstack/react-router";
import publicSet from "virtual:kakuzuke/public";
import { GuestScreen } from "../guest/GuestScreen.tsx";

export const Route = createFileRoute("/")({
  component: () => <GuestScreen set={publicSet} />,
});
