import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { Mark } from "@/components/Mark";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Sign in · MW Chat",
  manifest: "/manifest.webmanifest",
};

export default async function Login() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="on-navy flex min-h-dvh flex-col items-center justify-center bg-navy px-6 text-white">
      <Mark className="w-16" />
      <h1 className="mt-5 font-display text-[26px]">MW Chat</h1>
      {adminConfigured() ? (
        <LoginForm />
      ) : (
        <p className="mt-6 max-w-[300px] text-center text-[14px] text-white/80">
          Sign-in is not set up yet. Add ADMIN_PASSWORD to this project in Vercel, then redeploy.
        </p>
      )}
    </div>
  );
}
