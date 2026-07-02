"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/api-error";
import {
  type AuthenticationMembership,
  useAuth,
} from "@/lib/auth/auth-provider";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, login, selectOrganization } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<AuthenticationMembership[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state.status === "authenticated") {
      router.replace(searchParams.get("next") || "/dashboard");
    }
  }, [router, searchParams, state.status]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOrganizations([]);

    try {
      const response = await login({ email, password });

      if (response.status === "organization_selection_required") {
        setOrganizations(response.organizations);
        return;
      }

      router.replace(searchParams.get("next") || "/dashboard");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "No fue posible iniciar sesion.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOrganizationSelection(organizationId: string) {
    setSubmitting(true);
    setError(null);

    try {
      await selectOrganization(organizationId);
      router.replace(searchParams.get("next") || "/dashboard");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible seleccionar la organizacion.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="auth-card__header">
          <h1>Courier SaaS</h1>
          <p>Backoffice administrativo del courier</p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="auth-form" onSubmit={handleLogin}>
          <FormField label="Correo electronico" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>

          <FormField label="Contrasena" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Ingresando..." : "Iniciar sesion"}
          </Button>
        </form>

        {organizations.length > 0 ? (
          <div className="auth-selection">
            <h2>Selecciona tu organizacion</h2>
            <div className="auth-selection__list">
              {organizations.map((organization) => (
                <Button
                  key={organization.organizationId}
                  variant="secondary"
                  disabled={submitting}
                  onClick={() =>
                    void handleOrganizationSelection(organization.organizationId)
                  }
                >
                  {organization.organizationName}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState label="Preparando acceso..." />}>
      <LoginPageContent />
    </Suspense>
  );
}
