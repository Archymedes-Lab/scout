import { Suspense } from "react";
import { PlacesView } from "@/components/views/Places";
export const metadata = { title: "Places" };
export default function Page() { return <Suspense><PlacesView /></Suspense>; }
