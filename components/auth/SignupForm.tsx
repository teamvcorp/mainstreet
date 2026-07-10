"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { signupSchema, type SignupInput } from "@/schemas/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError, FormShell } from "@/components/auth/FormShell";

export function SignupForm({ callbackUrl = "/account" }: { callbackUrl?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Could not create your account.");
      return;
    }
    // Immediately sign the new user in.
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (result?.error) {
      setFormError("Account created, but sign-in failed. Try logging in.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <FormShell title="Create your account" subtitle="Join your hometown on MainStreet.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="text-sm font-medium" htmlFor="name">Full name</label>
          <Input id="name" autoComplete="name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          <FieldError message={errors.password?.message} />
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create account"}
        </Button>
      </form>

      <GoogleButton callbackUrl={callbackUrl} label="Sign up with Google" />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </FormShell>
  );
}

export function GoogleButton({ callbackUrl, label }: { callbackUrl: string; label: string }) {
  return (
    <>
      <div className="relative py-1 text-center">
        <span className="relative z-10 bg-card px-2 text-xs uppercase tracking-wide text-muted-foreground">
          or
        </span>
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl })}>
        {label}
      </Button>
    </>
  );
}
