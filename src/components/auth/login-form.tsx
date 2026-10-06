"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/field";
import { canAccessPath, isRole } from "@/domain/roles";
import { loginSchema } from "@/domain/validation";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import type { UserSummaryDTO } from "@/lib/dto";

/** Only same-site paths the role may open are honoured as post-login targets. */
function safeNext(nextPath: string | undefined, role: unknown): string | null {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.startsWith("/login")) return null;
  if (!isRole(role)) return null;
  const pathname = nextPath.split(/[?#]/)[0] ?? nextPath;
  return canAccessPath(role, pathname) ? nextPath : null;
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await apiRequest<{ user: UserSummaryDTO; redirectTo: string }>("/api/auth/login", {
        method: "POST",
        body: parsed.data,
      });
      window.location.assign(safeNext(nextPath, result.user.role) ?? result.redirectTo);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiRequestError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
      }
      setFormError(error instanceof ApiRequestError ? error.message : "Sign-in failed. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? (
        <Alert tone="danger" role="alert" title="Sign-in failed">
          {formError}
        </Alert>
      ) : null}
      <FormField id="email" label="Work email" required error={errors.email}>
        {(describedBy) => (
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="name@apparelflow.demo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(errors.email)}
            aria-describedby={describedBy}
            required
          />
        )}
      </FormField>
      <FormField id="password" label="Password" required error={errors.password}>
        {(describedBy) => (
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              invalid={Boolean(errors.password)}
              aria-describedby={describedBy}
              className="pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>
        )}
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={submitting} icon={<LogIn className="size-5" aria-hidden="true" />}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
