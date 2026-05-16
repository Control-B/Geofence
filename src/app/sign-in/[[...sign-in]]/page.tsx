import {SignIn} from "@clerk/nextjs";

export default function SignInPage() {
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