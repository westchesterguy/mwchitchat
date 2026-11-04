"use client";

import { useState } from "react";
import { Spinner } from "../ui/icons";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/admin";
      return;
    }
    setBusy(false);
    setError(
      res?.status === 429
        ? "Too many attempts. Wait a few minutes and try again."
        : res?.status === 401
          ? "That password is not right."
          : "Sign-in failed. Check your connection and try again.",
    );
  };

  return (
    <form onSubmit={submit} className="mt-10 w-full">
      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={`h-[52px] w-full rounded-2xl border bg-white/10 px-4 text-[16px] text-white outline-none transition-[border-color,background-color] placeholder:text-white/45 focus:bg-white/15 ${
          error ? "border-[#ffb4a8]" : "border-white/20 focus:border-white/60"
        }`}
      />
      {error && <p className="anim-fade mt-2 px-1 text-[13px] text-[#ffc9bf]">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="press mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-navy shadow-[0_6px_20px_rgba(0,0,0,0.25)] disabled:opacity-60"
      >
        {busy && <Spinner />}
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
