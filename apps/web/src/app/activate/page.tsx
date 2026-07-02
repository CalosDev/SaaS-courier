"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/api-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function readActivationTokenFromHash(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fragment = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(fragment);
  const token = params.get("token");
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", cleanUrl);
  return token;
}

export default function ActivatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(() => readActivationTokenFromHash());

  const passwordsMatch = useMemo(
    () => password.length > 0 && password === confirmPassword,
    [confirmPassword, password],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("El enlace de activación no es válido.");
      return;
    }

    if (!passwordsMatch) {
      setError("La confirmación de contraseña no coincide.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post<void>("/accounts/activate", {
        token,
        password,
      });
      setToken(null);
      setPassword("");
      setConfirmPassword("");
      router.replace("/login?activated=1");
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "No fue posible activar la cuenta.",
      );
    } finally {
      setSubmitting(false);
      setPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="auth-card__header">
          <h1>Activar cuenta</h1>
          <p>Define una contraseña para completar tu acceso.</p>
        </div>

        {!token ? (
          <Alert tone="warning">
            El token de activación no está disponible o ya fue consumido.
          </Alert>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField label="Contraseña" htmlFor="activation-password">
            <Input
              id="activation-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

          <FormField
            label="Confirmar contraseña"
            htmlFor="activation-password-confirm"
            error={
              confirmPassword.length > 0 && !passwordsMatch
                ? "La confirmación debe coincidir."
                : null
            }
          >
            <Input
              id="activation-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </FormField>

          <Button type="submit" disabled={submitting || !token || !passwordsMatch}>
            {submitting ? "Activando..." : "Activar cuenta"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
