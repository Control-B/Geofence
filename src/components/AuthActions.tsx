"use client";

import {UserButton, useUser} from "@clerk/nextjs";
import Link from "next/link";

export function AuthActions() {
  const {isSignedIn, isLoaded} = useUser();
  const devAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

  if (!isLoaded) {
    return <span className="rounded-full bg-white/10 px-4 py-2 text-white/70">Loading...</span>;
  }

  if (devAuthBypass) {
    return (
      <>
        <span className="hidden rounded-full border border-orange-200/30 bg-orange-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-orange-100 sm:inline-flex">
          Dev bypass
        </span>
        <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 text-asphalt shadow-sm">
          Operations
        </Link>
      </>
    );
  }

  if (!isSignedIn) {
    return (
      <Link href="/sign-in" className="rounded-full bg-white px-4 py-2 text-asphalt shadow-sm">
        Sign In
      </Link>
    );
  }

  return (
    <>
      <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 text-asphalt shadow-sm">
        Dashboard
      </Link>
      <UserButton />
    </>
  );
}
