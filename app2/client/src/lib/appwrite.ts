/**
 * Appwrite in the browser: sign-up, sign-in and the user's own profile row.
 * Configure in app2/client/.env (see README). Without it the app runs in demo mode:
 * accounts stay on this device only, like the 2.0 prototype.
 */
import { Account, Client, ID, Permission, Role, TablesDB } from "appwrite";
import type { Prefs } from "./state";

const env = import.meta.env;
const ENDPOINT: string = env.VITE_APPWRITE_ENDPOINT || "";
const PROJECT: string = env.VITE_APPWRITE_PROJECT_ID || "";
const DB: string = env.VITE_APPWRITE_DATABASE_ID || "finurheilu";
const PROFILES = "profiles";

export const appwriteOn = !!(ENDPOINT && PROJECT);

let client: Client | null = null;
const c = () => (client ||= new Client().setEndpoint(ENDPOINT).setProject(PROJECT));
const account = () => new Account(c());
const tables = () => new TablesDB(c());

export interface AwUser { id: string; name: string; email: string }

export async function register(name: string, email: string, password: string): Promise<AwUser> {
  await account().create({ userId: ID.unique(), email, password, name });
  return login(email, password);
}

export async function login(email: string, password: string): Promise<AwUser> {
  try { await account().deleteSession({ sessionId: "current" }); } catch { /* no old session */ }
  await account().createEmailPasswordSession({ email, password });
  return currentUser() as Promise<AwUser>;
}

export async function currentUser(): Promise<AwUser | null> {
  if (!appwriteOn) return null;
  try {
    const u = await account().get();
    return { id: u.$id, name: u.name, email: u.email };
  } catch {
    return null;
  }
}

export async function logout() {
  try { await account().deleteSession({ sessionId: "current" }); } catch { /* already signed out */ }
}

/** The settings that follow the user between devices. */
const SYNCED: (keyof Prefs)[] = ["teams", "tf", "lang", "voice", "notif", "mode", "len", "tone", "sub", "poll", "picks", "town", "points", "onboarded"];

export async function loadProfile(userId: string): Promise<Partial<Prefs> | null> {
  try {
    const row = (await tables().getRow({ databaseId: DB, tableId: PROFILES, rowId: userId })) as unknown as { prefs: string };
    return JSON.parse(row.prefs);
  } catch {
    return null;
  }
}

let timer = 0;
/** Save the user's settings to their own row (debounced). Only that user can read or change it. */
export function saveProfile(userId: string, p: Prefs) {
  clearTimeout(timer);
  timer = window.setTimeout(async () => {
    const data = Object.fromEntries(SYNCED.map((k) => [k, p[k]]));
    try {
      await tables().upsertRow({
        databaseId: DB, tableId: PROFILES, rowId: userId,
        data: { user_id: userId, prefs: JSON.stringify(data) },
        permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
      });
    } catch (e) {
      console.warn("Appwrite profile save failed", e);
    }
  }, 800);
}

export function friendlyError(e: unknown, fallback: string): string {
  const m = (e as { message?: string; type?: string })?.type || (e as Error)?.message || "";
  if (/user_already_exists|already exists/i.test(m)) return "An account with this email already exists. Log in instead.";
  if (/user_invalid_credentials|Invalid credentials/i.test(m)) return fallback;
  if (/password/i.test(m)) return (e as Error).message;
  if (/Failed to fetch|NetworkError/i.test(m)) return "Can't reach Appwrite. Check VITE_APPWRITE_ENDPOINT and that localhost is added as a Web platform.";
  return (e as Error)?.message || fallback;
}
