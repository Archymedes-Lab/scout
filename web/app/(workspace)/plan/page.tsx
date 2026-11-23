import { Suspense } from "react";
import { PlanView } from "@/components/views/Plan";
export const metadata = { title: "Plan" };
export default function Page() { return <Suspense><PlanView /></Suspense>; }
