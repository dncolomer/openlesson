"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Card } from "@/components/ui";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import { getBaseUrl } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${getBaseUrl()}/auth/callback`,
        },
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
          <div className="w-16 h-16 rounded-full bg-[var(--color-emerald)]/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-[var(--color-emerald)]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)] mb-2">
            Check Your Email
          </h1>
          <p className="text-[var(--color-stone)] mb-6">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. 
            Click the link to verify your account.
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
          Create Your Account
        </h1>
        <p className="text-[var(--color-stone)]">
          Start your learning journey today
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-pebble)]" />
          <Input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="pl-12"
            required
          />
        </div>

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

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-pebble)]" />
          <Input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-12"
            required
            minLength={8}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-pebble)]" />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-12"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-sand)] text-center">
        <p className="text-[var(--color-stone)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--color-indigo)] font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  );
}
