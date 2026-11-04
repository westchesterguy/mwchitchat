"use client";

import { useState } from "react";

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
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = "/admin";
      return;
    }
    setError(
      res.status === 429
        ? "Too many attempts. Wait a few minutes and try again."
        : res.status === 401
          ? "That password is not right."
          : "Sign-in failed. Please try again.",
    );
  };

  return (
    <form onSubmit={submit} className="mt-8 w-full max-w-[300px]">
      <label htmlFor="password" className="mb-1.5 block text-[12px] uppercase tracking-[0.08em] text-white/70">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-sm border border-white/30 bg-white/10 px-3 py-3 text-[15px] text-white outline-none focus:border-white"
      />
      {error && <p className="mt-2 text-[13px] text-[#ffb4a8]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-sm bg-white px-5 py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-navy disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
