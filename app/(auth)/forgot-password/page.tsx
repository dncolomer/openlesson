"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Card } from "@/components/ui";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { getBaseUrl } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getBaseUrl()}/auth/callback?type=recovery`,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card padding="lg" className="shadow-xl">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-indigo)]/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-[var(--color-indigo)]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)] mb-2">
            Check Your Email
          </h1>
          <p className="text-[var(--color-stone)] mb-6">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a 
            password reset link.
          </p>
          <Link href="/login">
            <Button variant="secondary">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="shadow-xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-charcoal)] mb-2">
          Reset Password
        </h1>
        <p className="text-[var(--color-stone)]">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-pebble)]" />
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-12"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-sand)] text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[var(--color-indigo)] font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>
      </div>
    </Card>
  );
}
