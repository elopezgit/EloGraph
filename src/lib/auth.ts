/* Sesión de la interfaz. AVISO: es solo una barrera de interfaz: al ser una app
   puramente de cliente, las credenciales viajan en el bundle JS y no sustituyen
   a una autenticación real con servidor. */

const AUTH_KEY = "elograph.auth.v1";
const USER = "elograph";
const PASSWORD = "123456";

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn(user: string, password: string): boolean {
  if (user.trim() !== USER || password !== PASSWORD) return false;
  try {
    sessionStorage.setItem(AUTH_KEY, "1");
  } catch {
    // si no se puede guardar, la sesión dura solo hasta recargar
  }
  return true;
}

export function logout(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY);
  } catch {
    // almacenamiento no disponible
  }
}
