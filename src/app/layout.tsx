import {ClerkProvider} from "@clerk/nextjs";
import type {Metadata} from "next";
import Link from "next/link";
import {AuthActions} from "@/components/AuthActions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verified Truck Check-In",
  description: "GPS verified warehouse check-ins, SMS handoff, document uploads, and self-serve signing."
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-asphalt/90 backdrop-blur">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-2 font-black text-white">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-safety text-lg">G</span>
                GateVerify
              </Link>
              <div className="flex items-center gap-3 text-sm font-semibold">
                <Link href="/check-in" className="hidden rounded-full px-4 py-2 text-white/80 hover:text-white sm:block">
                  Check in
                </Link>
                <AuthActions />
              </div>
            </nav>
          </header>
          {children}
          <footer className="border-t border-white/10 bg-asphalt text-white">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8">
              <div>
                <Link href="/" className="flex w-fit items-center gap-2 font-black">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-safety text-lg">G</span>
                  GateVerify
                </Link>
                <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                  GPS-verified truck check-ins, secure document links, self-serve signing, and warehouse dashboard visibility.
                </p>
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[.25em] text-orange-200">Workflow</p>
                <div className="mt-4 grid gap-3 text-sm font-bold text-slate-300">
                  <Link href="/check-in" className="hover:text-white">Driver check-in</Link>
                  <Link href="/dashboard" className="hover:text-white">Warehouse dashboard</Link>
                  <Link href="/sign-in" className="hover:text-white">Team sign in</Link>
                </div>
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[.25em] text-orange-200">Services</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  <span><strong className="text-white">Check-in:</strong> GPS + SMS handoff</span>
                  <span><strong className="text-white">Docs:</strong> Tokenized uploads</span>
                  <span><strong className="text-white">Signing:</strong> Mobile signatures</span>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-4 text-center text-xs font-bold text-slate-400">
              Built for busy docks, carriers, and drivers who need faster gate verification.
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}