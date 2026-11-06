import type { Metadata } from "next";
import { ThemeScript } from "@/components/admin/ThemeScript";
import { DevApp, type Tab } from "@/components/developer/DevApp";
import { DevLogin } from "@/components/developer/DevLogin";
import { WebOnly } from "@/components/developer/WebOnly";
import { Mark } from "@/components/Mark";
import { devConfigured, isDeveloper } from "@/lib/dev-auth";

export const metadata: Metadata = { title: "Developer · MW Chat" };
export const dynamic = "force-dynamic";

const TABS: Tab[] = ["leads", "activity", "health", "settings", "widget", "ai", "data"];

export default async function DeveloperPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab as Tab | undefined;
  const signedIn = await isDeveloper();
  return (
    <>
      <ThemeScript />
      <WebOnly>
        {signedIn ? (
          <DevApp initialTab={asked && TABS.includes(asked) ? asked : "leads"} />
        ) : (
          <div className="on-navy flex min-h-dvh flex-col items-center justify-center bg-chrome px-6 text-white">
            <div className="anim-rise flex w-full max-w-[340px] flex-col items-center">
              <Mark className="w-14" />
              <h1 className="mt-6 font-display text-[28px] leading-none">Developer</h1>
              <p className="mt-2 text-[14px] text-white/65">MW Chat settings, leads and health</p>
              {devConfigured() ? (
                <DevLogin />
              ) : (
                <p className="mt-8 text-center text-[14px] text-white/80">
                  Sign-in is not set up yet. Add ADMIN_PASSWORD (or DEVELOPER_PASSWORD) to this project in Vercel, then redeploy.
                </p>
              )}
            </div>
          </div>
        )}
      </WebOnly>
    </>
  );
}
