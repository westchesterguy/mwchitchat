"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Spinner } from "../ui/icons";
import { Switch } from "../ui/Switch";
import { card, devApi, h2, input, plural, primary, secondary, sub, when } from "./api";

type Mode = "drafts" | "cover" | "always";

interface Settings {
  enabled: boolean;
  mode: Mode;
  provider: string;
  models: Record<string, string>;
  baseUrls: Record<string, string>;
  effort: "low" | "medium" | "high";
  name: string;
  instructions: string;
  context: string;
  siteContext: Record<string, string>;
  handoff: string;
  askContact: boolean;
  matchLanguage: boolean;
  length: "short" | "medium";
  notify: boolean;
  maxPerChat: number;
  maxPerMonth: number;
}

interface Provider {
  id: string;
  name: string;
  maker: string;
  kind: "anthropic" | "openai";
  keys: string[];
  baseUrl?: string;
  defaultModel?: string;
  models?: string[];
  console: string;
  keySet: boolean;
}

interface Data {
  settings: Settings;
  defaults: Settings;
  providers: Provider[];
  sites: { id: string; domain: string }[];
  usage: { replies: number; drafts: number; failed: number };
  log: {
    id: number;
    conversation_id: string | null;
    purpose: string;
    provider: string;
    model: string;
    ok: boolean;
    error: string | null;
    ms: number | null;
    created_at: string;
  }[];
}

const MODES: { id: Mode; title: string; body: string }[] = [
  {
    id: "drafts",
    title: "Drafts for you",
    body: "Never writes to visitors. A Suggest a reply button in each chat writes a draft you edit and send yourself.",
  },
  {
    id: "cover",
    title: "Covers for you",
    body: "Answers on its own only while you're set to Away, or when a visitor has waited past the rescue time. Drafts too.",
  },
  {
    id: "always",
    title: "Always on",
    body: "Answers every message first. Steps back from a chat for 30 minutes whenever you write in it. Drafts too.",
  },
];

const RULES = [
  "Says it is an AI assistant, never Michael or a person.",
  "States only facts from your context or the chat. Never invents prices, values, taxes, sizes, school ratings, market numbers, dates or listing details.",
  "Fair housing: never describes or recommends areas by who lives there, never calls areas \"safe\" or \"good for families\", never ranks schools.",
  "No legal, tax, mortgage or financing advice.",
  "Never promises availability, showings, prices or terms.",
  "Never recommends or vouches for another business.",
  "Never asks for financial details, ID numbers or passwords.",
  "Plain text, your voice, no em dashes (removed even if it writes one).",
];

function Field({ label, hint, count, children }: { label: string; hint?: React.ReactNode; count?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {count && <span className="text-[11px] tabular-nums text-faint">{count}</span>}
      </span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

function Toggle({ title, note, checked, onChange }: { title: string; note?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 border-t border-line py-3 first:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {note && <p className="mt-0.5 text-[13px] text-muted">{note}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/**
 * The AI assistant's settings: which service and model, how it may act, its
 * voice, what it knows, the rules it always follows, limits, a test, and a
 * log. Off until switched on; while off nothing is sent to any AI service.
 */
export function AiPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [testSite, setTestSite] = useState("westchesterguy");
  const [question, setQuestion] = useState("Hi, what towns do you cover?");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text?: string; error?: string; ms: number; model: string } | null>(null);

  const load = () =>
    devApi<Data>("ai").then(({ ok, data }) => {
      if (!ok) return;
      setData(data);
      setSettings(data.settings);
      setSaved(JSON.stringify(data.settings));
    });

  useEffect(() => {
    load();
  }, []);

  if (!data || !settings) {
    return (
      <div className={card} aria-busy>
        <span className="skeleton block h-5 w-40" />
        <span className="skeleton mt-4 block h-32 w-full !rounded-xl" />
      </div>
    );
  }

  const dirty = JSON.stringify(settings) !== saved;
  const set = (patch: Partial<Settings>) => {
    setMessage(null);
    setSettings((s) => ({ ...s!, ...patch }));
  };
  const provider = data.providers.find((p) => p.id === settings.provider) ?? data.providers[0];
  const model = settings.models[provider.id] ?? provider.defaultModel ?? "";
  const base = settings.baseUrls[provider.id] ?? provider.baseUrl ?? "";
  const options = models[provider.id] ?? provider.models ?? [];

  const save = async () => {
    setBusy(true);
    const { ok, data: d } = await devApi<{ settings: Settings; message?: string }>("ai", "PUT", { settings });
    setBusy(false);
    if (ok) {
      setSettings(d.settings);
      setSaved(JSON.stringify(d.settings));
      setMessage({ ok: true, text: d.settings.enabled ? "Saved. The assistant is on." : "Saved. The assistant is off." });
      load();
    } else {
      setMessage({ ok: false, text: d.message ?? "Could not save. Try again." });
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setModelNote(null);
    const q = new URLSearchParams({ provider: provider.id });
    if (provider.kind === "openai" && base) q.set("base", base);
    const { ok, data: d } = await devApi<{ models?: string[]; error?: string }>(`ai/models?${q}`);
    setLoadingModels(false);
    if (ok && d.models) {
      setModels((m) => ({ ...m, [provider.id]: d.models! }));
      setModelNote(`${plural(d.models.length, "model")} found. Pick one from the list or type it.`);
    } else {
      setModelNote(d.error ?? "Could not load the list.");
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    const { data: d } = await devApi<{ ok: boolean; text?: string; error?: string; ms: number; model: string }>("ai/test", "POST", {
      settings,
      question,
      site: testSite,
    });
    setTesting(false);
    setResult(d);
  };

  return (
    <div className="space-y-4">
      <section className={`${card} ${settings.enabled ? "ring-2 ring-navy/30" : ""}`}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className={h2}>AI assistant</h2>
            <p className={sub}>
              {settings.enabled
                ? `On: ${MODES.find((m) => m.id === settings.mode)!.title.toLowerCase()}, using ${provider.name}${model ? ` (${model})` : ""}.`
                : "Off. Nothing is sent to any AI service. Everything below is kept ready for when you turn it on."}
            </p>
          </div>
          <Switch checked={settings.enabled} onChange={(v) => set({ enabled: v })} label="AI assistant" />
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>AI service</h2>
        <p className={sub}>Each needs its own key, added in Vercel as an environment variable. Only whether a key is set is shown here.</p>
        <div role="radiogroup" aria-label="AI service" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.providers.map((p) => {
            const on = p.id === provider.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  set({ provider: p.id });
                  setModelNote(null);
                }}
                className={`press rounded-xl border p-3 text-left ${on ? "border-navy bg-navy-tint" : "border-line hover:border-ink-soft/40"}`}
              >
                <span className={`block text-[14px] font-semibold ${on ? "text-accent" : "text-ink"}`}>{p.name}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted">{p.maker}</span>
                <span className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium ${p.keySet ? "text-ok" : "text-faint"}`}>
                  {p.keySet ? (
                    <>
                      <CheckIcon className="h-3 w-3" strokeWidth={2.4} /> Key set
                    </>
                  ) : (
                    "No key yet"
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 rounded-xl bg-canvas p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Field
              label="Model"
              hint={
                modelNote ??
                (provider.kind === "anthropic"
                  ? "Opus 5.5 is the most capable; Sonnet 5.5 and Haiku 5.5 are faster and cost less."
                  : "Model names change often. Load the current list with your key, or type one from the service's site.")
              }
            >
              <span className="flex gap-2">
                <input
                  list={`models-${provider.id}`}
                  value={model}
                  placeholder={provider.kind === "anthropic" ? "claude-opus-5-5" : "Model name"}
                  onChange={(e) => set({ models: { ...settings.models, [provider.id]: e.target.value } })}
                  className={`${input} min-w-0 flex-1`}
                />
                <datalist id={`models-${provider.id}`}>
                  {options.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <button type="button" className={secondary} onClick={loadModels} disabled={loadingModels || !provider.keySet}>
                  {loadingModels && <Spinner />} Load list
                </button>
              </span>
            </Field>
            {provider.kind === "openai" && (
              <Field
                label="Service address"
                hint={
                  provider.id === "custom"
                    ? "Any service that accepts OpenAI-style chat requests, for example Together, Fireworks or your own server."
                    : base !== provider.baseUrl
                      ? "Changed from the service's usual address."
                      : "The service's usual address. Change it only if they move it."
                }
              >
                <input
                  value={base}
                  placeholder="https://"
                  onChange={(e) => set({ baseUrls: { ...settings.baseUrls, [provider.id]: e.target.value } })}
                  className={`${input} w-full`}
                />
              </Field>
            )}
            {provider.kind === "anthropic" && (
              <Field label="Thinking before it answers" hint="Low is quickest and suits chat; higher takes longer and costs more.">
                <select
                  value={settings.effort}
                  onChange={(e) => set({ effort: e.target.value as Settings["effort"] })}
                  className={`${input} w-full`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
            )}
          </div>
          <div className="text-[13px] leading-relaxed text-ink-soft">
            <p className="font-medium text-ink">Connecting {provider.name}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              {provider.console && <li>Create an API key at {provider.console}.</li>}
              <li>
                In Vercel, open the mwchitchat project, Settings, Environment Variables, and add{" "}
                <code className="rounded bg-surface px-1 py-0.5 text-[12px]">{provider.keys[0]}</code> with the key as its value.
              </li>
              <li>Redeploy, then come back here: the card shows Key set.</li>
              <li>Load the model list, pick one, and try it in Test below.</li>
            </ol>
            <p className="mt-2 text-muted">
              Visitors&rsquo; messages are sent to the service you choose. Use a paid plan: check its terms on whether it trains on
              your data, and mention the assistant in your sites&rsquo; privacy policy before turning it on.
            </p>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>What it may do</h2>
        <div role="radiogroup" aria-label="Mode" className="mt-3 grid gap-2 md:grid-cols-3">
          {MODES.map((m) => {
            const on = settings.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ mode: m.id })}
                className={`press rounded-xl border p-3.5 text-left ${on ? "border-navy bg-navy-tint" : "border-line hover:border-ink-soft/40"}`}
              >
                <span className={`block text-[14px] font-semibold ${on ? "text-accent" : "text-ink"}`}>{m.title}</span>
                <span className="mt-1 block text-[13px] leading-snug text-muted">{m.body}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-muted">In any mode you can turn it off for a single chat from that chat&rsquo;s menu in the chat app.</p>
      </section>

      <section className={card}>
        <h2 className={h2}>Its voice</h2>
        <div className="mt-3 space-y-4">
          <Field label="Name visitors see" hint="Shown above its messages in the chat window.">
            <input value={settings.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} className={`${input} w-full max-w-sm`} />
          </Field>
          <Field label="How it writes" count={`${settings.instructions.length}/4000`}>
            <textarea
              rows={4}
              value={settings.instructions}
              onChange={(e) => set({ instructions: e.target.value })}
              className={`${input} h-auto w-full resize-y py-2 leading-snug`}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-ink">
            Reply length
            <div role="radiogroup" aria-label="Reply length" className="inline-grid grid-cols-2 rounded-xl bg-canvas p-1">
              {(["short", "medium"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={settings.length === l}
                  onClick={() => set({ length: l })}
                  className={`press rounded-[9px] px-4 py-1.5 text-[13px] font-medium ${
                    settings.length === l ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-muted"
                  }`}
                >
                  {l === "short" ? "A few sentences" : "A short paragraph"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Toggle
              title="Ask for missing contact details"
              note="Once, naturally, so you can follow up."
              checked={settings.askContact}
              onChange={(v) => set({ askContact: v })}
            />
            <Toggle
              title="Answer in the visitor's language"
              checked={settings.matchLanguage}
              onChange={(v) => set({ matchLanguage: v })}
            />
            <Toggle
              title="Notify me when it replies"
              note="A notification on your phone with what it wrote."
              checked={settings.notify}
              onChange={(v) => set({ notify: v })}
            />
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Context</h2>
        <p className={sub}>
          What it knows. It answers only from this and the chat, so add what you want it to be able to say: your services, the towns
          you cover, how you work, common questions and your answers, links to pages on your sites. Leave out anything you
          wouldn&rsquo;t want quoted.
        </p>
        <div className="mt-3 space-y-4">
          <Field label="For both sites" count={`${settings.context.length.toLocaleString()}/30,000`}>
            <textarea
              rows={10}
              value={settings.context}
              placeholder={"About Michael: ...\nTowns covered: ...\nServices for buyers: ...\nQ: ... A: ..."}
              onChange={(e) => set({ context: e.target.value })}
              className={`${input} h-auto w-full resize-y py-2 font-mono text-[13px] leading-relaxed`}
            />
          </Field>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.sites.map((s) => (
              <Field key={s.id} label={`Only on ${s.domain}`} count={`${(settings.siteContext[s.id] ?? "").length.toLocaleString()}/10,000`}>
                <textarea
                  rows={5}
                  value={settings.siteContext[s.id] ?? ""}
                  onChange={(e) => set({ siteContext: { ...settings.siteContext, [s.id]: e.target.value } })}
                  className={`${input} h-auto w-full resize-y py-2 font-mono text-[13px] leading-relaxed`}
                />
              </Field>
            ))}
          </div>
          <div className="rounded-xl bg-canvas p-3.5 text-[13px] text-ink-soft">
            <p className="font-medium text-ink">It also knows, in every chat</p>
            <p className="mt-1">
              Your name and the two sites, your phone number from the sites&rsquo; contact details, whether you&rsquo;re online or
              away, the page the chat started on, and the visitor&rsquo;s name, email, phone and pre-chat answers.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className={h2}>Hand these to you</h2>
          <p className={sub}>One topic per line. It says you&rsquo;ll follow up instead of answering.</p>
          <textarea
            rows={6}
            value={settings.handoff}
            onChange={(e) => set({ handoff: e.target.value })}
            className={`${input} mt-3 h-auto w-full resize-y py-2 leading-snug`}
          />
        </section>
        <section className={card}>
          <h2 className={h2}>Rules it always follows</h2>
          <p className={sub}>Built in, not editable.</p>
          <ul className="mt-3 space-y-2 text-[13px] text-ink-soft">
            {RULES.map((r) => (
              <li key={r} className="flex gap-2">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.2} />
                {r}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={card}>
        <h2 className={h2}>Limits</h2>
        <p className={sub}>
          This month: {plural(data.usage.replies, "reply", "replies")} to visitors, {plural(data.usage.drafts, "draft")},{" "}
          {plural(data.usage.failed, "failed call")}.
        </p>
        <div className="mt-3 flex flex-wrap gap-6 text-[14px] text-ink">
          <label className="flex items-center gap-2">
            At most
            <input
              type="number"
              min={1}
              max={100}
              value={settings.maxPerChat}
              onChange={(e) => set({ maxPerChat: Number(e.target.value) })}
              className={`${input} w-20 text-center`}
            />
            replies in one chat
          </label>
          <label className="flex items-center gap-2">
            and
            <input
              type="number"
              min={1}
              max={100000}
              value={settings.maxPerMonth}
              onChange={(e) => set({ maxPerMonth: Number(e.target.value) })}
              className={`${input} w-24 text-center`}
            />
            a month
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Test</h2>
        <p className={sub}>Asks {provider.name} one question with the settings above, saved or not, as a visitor would. Works while it&rsquo;s off and touches no real chat.</p>
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <select value={testSite} onChange={(e) => setTestSite(e.target.value)} className={input}>
            {data.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.domain}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            value={question}
            maxLength={1000}
            onChange={(e) => setQuestion(e.target.value)}
            className={`${input} h-auto min-w-[240px] flex-1 resize-y py-2`}
          />
          <button type="button" className={primary} onClick={test} disabled={testing || !question.trim()}>
            {testing && <Spinner />} Ask
          </button>
        </div>
        {result && (
          <div className={`anim-fade mt-3 rounded-xl p-3.5 text-[14px] ${result.ok ? "bg-canvas text-ink" : "bg-canvas text-danger"}`}>
            {result.ok ? <p className="whitespace-pre-wrap">{result.text}</p> : <p>{result.error}</p>}
            <p className="mt-1.5 text-[12px] text-muted">
              {result.model || provider.name} · {(result.ms / 1000).toFixed(1)} sec
            </p>
          </div>
        )}
      </section>

      <section className={`${card} !p-0`}>
        <div className="px-4 pb-3 pt-4 sm:px-5">
          <h2 className={h2}>Recent activity</h2>
          <p className={sub}>Every call to an AI service, newest first.</p>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-y border-line text-[11px] uppercase tracking-[0.06em] text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold sm:pl-5">When</th>
                <th className="px-3 py-2 font-semibold">For</th>
                <th className="px-3 py-2 font-semibold">Service</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-4 py-2 font-semibold sm:pr-5">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.log.map((l) => (
                <tr key={l.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted sm:pl-5">{when(l.created_at)}</td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {l.purpose === "reply" ? "Reply" : l.purpose === "draft" ? "Draft" : "Test"}
                    {l.conversation_id && (
                      <a href={`/chatapp/c/${l.conversation_id}`} target="_blank" rel="noopener" className="ml-1.5 text-accent hover:underline">
                        chat
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {data.providers.find((p) => p.id === l.provider)?.name ?? l.provider} <span className="text-faint">{l.model}</span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{l.ms !== null ? `${(l.ms / 1000).toFixed(1)}s` : ""}</td>
                  <td className="px-4 py-2.5 sm:pr-5">{l.ok ? <span className="font-medium text-ok">OK</span> : <span className="text-danger">{l.error}</span>}</td>
                </tr>
              ))}
              {data.log.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Nothing yet. Nothing has been sent to any AI service.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={secondary}
          onClick={() => {
            setSettings({ ...data.defaults, enabled: settings.enabled });
            setMessage({ ok: true, text: "Defaults filled in. Save to use them." });
          }}
        >
          Restore defaults
        </button>
        {message && !dirty && <p className={`text-[14px] ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
      </div>

      {dirty && (
        <div className="anim-rise fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 sm:px-2">
            <p className="flex-1 text-[14px] text-ink-soft">
              {message && !message.ok ? <span className="text-danger">{message.text}</span> : "You have unsaved changes."}
            </p>
            <button type="button" className={secondary} onClick={() => setSettings(JSON.parse(saved))}>
              Discard
            </button>
            <button type="button" className={primary} onClick={save} disabled={busy}>
              {busy && <Spinner />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
