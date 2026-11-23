import { Suspense } from "react";
import { OverviewView } from "@/components/views/Overview";
export const metadata = { title: "Overview" };
export default function Page() { return <Suspense><OverviewView /></Suspense>; }
