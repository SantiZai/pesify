"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const { authError, clearAuthError } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    clearAuthError();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthGuard redirige a /dashboard al detectar la sesión.
    } catch (err: unknown) {
      setError("Error al iniciar sesión: " + getAuthErrorCode(err));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    clearAuthError();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      setError("Error al registrar: " + getAuthErrorCode(err));
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

  const visibleError = error || authError;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Acceder</CardTitle>
          <CardDescription>Ingresa a tu cuenta familiar</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleLogin}>
            {visibleError && <p className="text-sm text-red-500 font-medium">{visibleError}</p>}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <Button type="submit">Iniciar Sesión</Button>
              <Button type="button" variant="outline" onClick={handleSignup}>Crear Cuenta</Button>
            </div>

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
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
