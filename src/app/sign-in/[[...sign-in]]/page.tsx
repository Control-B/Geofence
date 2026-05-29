import {SignIn} from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    return (
      <main className="page-shell grid place-items-center py-12">
        <div className="w-full max-w-md">
          <div className="hero-panel mb-6 text-center">
            <p className="eyebrow">Warehouse access</p>
            <h1 className="mt-2 text-3xl font-black">Auth bypass is enabled</h1>
            <p className="mt-3 text-slate-300">Dashboard access is open for this deployment until Clerk keys are configured.</p>
          </div>
          <Link href="/dashboard" className="primary-button w-full">Open dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell grid place-items-center py-12">
      <div className="w-full max-w-md">
        <div className="hero-panel mb-6 text-center">
          <p className="eyebrow">Warehouse access</p>
          <h1 className="mt-2 text-3xl font-black">Sign in to GateVerify</h1>
        </div>
        <SignIn routing="path" path="/sign-in" />
      </div>
    </main>
  );
}