"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requestResetSchema } from "@/schemas/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError, FormShell } from "@/components/auth/FormShell";

type FormValues = z.infer<typeof requestResetSchema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(requestResetSchema) });

  async function onSubmit(values: FormValues) {
    await fetch("/api/auth/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    // Always show the same confirmation (no account-existence disclosure).
    setSent(true);
  }

  if (sent) {
    return (
      <FormShell title="Check your email" subtitle="If an account exists for that address, we've sent a reset link.">
        <p className="text-center text-sm text-muted-foreground">
          The link expires in 1 hour.{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
        </p>
      </FormShell>
    );
  }

  return (
    <FormShell title="Reset your password" subtitle="Enter your email and we'll send a reset link.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
      </p>
    </FormShell>
  );
}
