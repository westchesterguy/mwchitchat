import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { ThemeScript } from "@/components/admin/ThemeScript";
import { Mark } from "@/components/Mark";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Sign in · MW Chat",
  manifest: "/manifest.webmanifest",
};

export default async function Login() {
  if (await isAdmin()) redirect("/chatapp");
  return (
    <>
      <ThemeScript />
      <div className="on-navy flex min-h-dvh flex-col items-center justify-center bg-chrome px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white">
        <div className="anim-rise flex w-full max-w-[340px] flex-col items-center">
          <Mark className="w-16" />
          <h1 className="mt-6 font-display text-[30px] leading-none">MW Chat</h1>
          <p className="mt-2 text-[14px] text-white/65">Conversations from your websites</p>
          {adminConfigured() ? (
            <LoginForm />
          ) : (
            <p className="mt-8 text-center text-[14px] text-white/80">
              Sign-in is not set up yet. Add ADMIN_PASSWORD to this project in Vercel, then redeploy.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
