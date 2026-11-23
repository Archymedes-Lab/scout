import { Suspense } from "react";
import { Wordmark } from "@/components/brand";
import { Topo } from "@/components/Topo";

export const metadata = { title: "Sign in" };

export default function Login(props: PageProps<"/login">) {
  return <Suspense>{props.searchParams.then((sp) => <LoginForm sp={sp} />)}</Suspense>;
}

function LoginForm({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-6">
      <div className="sky animate-fade !h-dvh" aria-hidden><Topo seed={33} /></div>
      <form method="post" action="/api/login" className="card flex w-full max-w-sm flex-col gap-5 p-8">
        <Wordmark height={18} />
        <p className="text-sm text-muted">Where Argus-1 finds its users. Archymedes internal: enter the team password.</p>
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-2"><span className="text-sm font-medium text-ink">Password</span>
          <input className="field" type="password" name="password" autoFocus required aria-invalid={sp.error ? true : undefined} />
        </label>
        {sp.error && <p className="text-xs text-danger">That password didn&apos;t match.</p>}
        <button className="h-11 rounded-pill bg-signal text-sm font-semibold text-on-signal hover:bg-signal-hover">Sign in</button>
      </form>
    </div>
  );
}
