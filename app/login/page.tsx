"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/config";
import {
  getAuthErrorCode,
  getFriendlyAuthError,
  useAuth,
} from "@/lib/firebase/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const EMAIL_STORAGE_KEY = "pesify-email-link";

function friendlyLinkError(code: string): string {
  if (code.includes("auth/invalid-email")) return "Ese email no es válido.";
  if (code.includes("auth/operation-not-allowed"))
    return "El ingreso por email no está habilitado en Firebase Console (Authentication > Sign-in method > Email link).";
  if (code.includes("auth/unauthorized-domain"))
    return "Este dominio no está autorizado en Firebase Console (Authentication > Settings > Authorized domains).";
  if (code.includes("auth/expired-action-code") || code.includes("auth/invalid-action-code"))
    return "El enlace venció o ya se usó. Pedí uno nuevo.";
  return getFriendlyAuthError(code);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { authError, clearAuthError } = useAuth();
  const router = useRouter();

  // ¿Volvemos de clickear el enlace del email?
  const [pendingLink] = useState(() =>
    typeof window !== "undefined" ? isSignInWithEmailLink(auth, window.location.href) : false
  );
  const [linkError, setLinkError] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!pendingLink) return;
    (async () => {
      setCompleting(true);
      try {
        let stored = window.localStorage.getItem(EMAIL_STORAGE_KEY);
        if (!stored) {
          stored = window.prompt("Confirmá tu email para completar el ingreso:");
        }
        if (!stored) {
          setLinkError("Necesitamos tu email para completar el ingreso.");
          return;
        }
        await signInWithEmailLink(auth, stored, window.location.href);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        // Limpia los parámetros del enlace. AuthGuard redirige al dashboard.
        router.replace("/login");
      } catch (err: unknown) {
        setLinkError(friendlyLinkError(getAuthErrorCode(err)));
      } finally {
        setCompleting(false);
      }
    })();
  }, [pendingLink, router]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    clearAuthError();
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Ingresá un email válido.");
      return;
    }
    setSending(true);
    try {
      await sendSignInLinkToEmail(auth, clean, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, clean);
      setLinkSent(true);
    } catch (err: unknown) {
      setError(friendlyLinkError(getAuthErrorCode(err)));
    } finally {
      setSending(false);
    }
  };

  // Popup primero (no recarga la página, AuthGuard redirige solo).
  // Si el navegador lo bloquea, fallback a redirect.
  const handleGoogleLogin = async () => {
    setError("");
    clearAuthError();
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = getAuthErrorCode(err);
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: unknown) {
          setError(getFriendlyAuthError(getAuthErrorCode(redirectErr)));
        }
      } else {
        setError(getFriendlyAuthError(code));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const visibleError = error || authError || linkError;

  if (pendingLink && completing) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 bg-background">
        <p className="text-sm text-muted-foreground">Completando tu ingreso...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image src="/logo.png" alt="Pesify" width={56} height={56} className="rounded-2xl" />
          <CardTitle className="text-2xl">Pesify</CardTitle>
          <CardDescription>Con Google o con un enlace a tu email</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleError && (
            <p className="mb-4 text-sm text-red-500 font-medium">{visibleError}</p>
          )}

          {linkSent ? (
            <div className="grid gap-4">
              <p className="text-sm">
                Te enviamos un enlace a <span className="font-bold">{email.trim()}</span>.
                Abrilo para entrar (revisá spam si no lo ves).
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLinkSent(false);
                  setError("");
                }}
              >
                Usar otro email
              </Button>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={handleSendLink}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="vos@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={sending} className="w-full">
                {sending ? "Enviando..." : "Enviarme enlace de ingreso"}
              </Button>
            </form>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={handleGoogleLogin} disabled={googleLoading} className="w-full">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {googleLoading ? "Conectando..." : "Google"}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Al ingresar aceptás los{" "}
            <Link href="/terms" className="font-medium text-primary hover:underline">
              Términos
            </Link>{" "}
            y la{" "}
            <Link href="/privacy" className="font-medium text-primary hover:underline">
              Política de Privacidad
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
