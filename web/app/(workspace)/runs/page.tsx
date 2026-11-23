import { Suspense } from "react";
import { RunsView } from "@/components/views/Runs";
export const metadata = { title: "Runs" };
export default function Page() { return <Suspense><RunsView /></Suspense>; }
