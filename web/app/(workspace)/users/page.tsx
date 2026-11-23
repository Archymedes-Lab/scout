import { Suspense } from "react";
import { UsersView } from "@/components/views/Users";
export const metadata = { title: "Users" };
export default function Page() { return <Suspense><UsersView /></Suspense>; }
