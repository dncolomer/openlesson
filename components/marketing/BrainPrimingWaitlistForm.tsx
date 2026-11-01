"use client";

import { FormEvent, useState } from "react";
import {
  BRAIN_PRIMING_COPY,
  storeBrainPrimingWaitlist,
} from "@/lib/marketing/brain-priming";

export function BrainPrimingWaitlistForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = storeBrainPrimingWaitlist({
        email: String(data.get("email") || ""),
        domain: String(data.get("domain") || ""),
        topic: String(data.get("topic") || ""),
        plan: String(data.get("plan") || ""),
      });
      setMessage(result.message);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the waitlist.");
    }
  }

  const copy = BRAIN_PRIMING_COPY.waitlist;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 border border-white/20 bg-black p-5 sm:p-6"
      data-brain-priming-waitlist-form
    >
      <fieldset>
        <legend className="text-sm text-zinc-300">{copy.domainLabel}</legend>
        <div className="mt-3 flex flex-col gap-2">
          {BRAIN_PRIMING_COPY.domains.items.map((domain) => (
            <label key={domain.id} className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="radio" name="domain" value={domain.id} required />
              <span>{domain.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="brain-priming-topic" className="block text-sm text-zinc-300">
          {copy.topicLabel}
        </label>
        <textarea
          id="brain-priming-topic"
          name="topic"
          required
          minLength={3}
          rows={3}
          placeholder={copy.topicPlaceholder}
          className="mt-2 w-full rounded-none border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="brain-priming-email" className="block text-sm text-zinc-300">
          {copy.emailLabel}
        </label>
        <input
          id="brain-priming-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 w-full rounded-none border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
        />
      </div>
      <fieldset>
        <legend className="text-sm text-zinc-300">{copy.planLabel}</legend>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
          {BRAIN_PRIMING_COPY.plans.items.map((plan) => (
            <label key={plan.id} className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="radio" name="plan" value={plan.id} />
              <span>{plan.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs leading-relaxed text-zinc-500">{copy.note}</p>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
      >
        {copy.submit}
      </button>
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-zinc-300" data-brain-priming-waitlist-stored>
          {message}
        </p>
      ) : null}
    </form>
  );
}
