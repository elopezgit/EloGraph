/* Pantalla de acceso inicial del sistema */

import { useState, type FormEvent } from "react";
import { signIn } from "../lib/auth";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (signIn(user, password)) {
      setError("");
      onSuccess();
    } else {
      setError("Usuario o contraseña incorrectos.");
    }
  };

  const inputCls =
    "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-700 to-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-7 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-blue-700">elograph</div>
          <p className="mt-1 text-xs text-gray-500">Acceso al sistema</p>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="login-user">
            Usuario
          </label>
          <input
            id="login-user"
            className={inputCls}
            value={user}
            onChange={(e) => { setUser(e.target.value); setError(""); }}
            autoComplete="username"
            autoFocus
            placeholder="Usuario"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="login-password">
            Contraseña
          </label>
          <div className="flex gap-2">
            <input
              id="login-password"
              className={inputCls}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete="current-password"
              placeholder="Contraseña"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="shrink-0 rounded border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-50"
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Entrar
        </button>

        <p className="mt-5 text-center text-[11px] text-gray-400">
          El acceso se mantiene solo mientras la pestaña esté abierta.
        </p>
      </form>
    </div>
  );
}
