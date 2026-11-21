// Page-level role checks. They only route people; the data itself is authorised again in SQL (lib/dal, lib/changes).
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { accountProfiles, sessionCookie } from "./dal/session";

export type Role = "student" | "teacher" | "staff";
export const HOME: Record<Role, string> = { student: "/", staff: "/staff", teacher: "/teacher" };
export const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export const sessionToken = cache(async () => (await cookies()).get(sessionCookie)?.value ?? null);

export const currentProfiles = cache(async () => {
  const token = await sessionToken();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { token: null, profiles: [] as Awaited<ReturnType<typeof accountProfiles>> };
  return { token, profiles: await accountProfiles(token) };
});

/** signed in with this role, or: not signed in -> /login; other role -> that role's home */
export async function requireRole(role: Role) {
  const { token, profiles } = await currentProfiles();
  if (!token || !profiles.length) redirect("/login");
  const profile = profiles.find((p) => p.role === role);
  if (!profile) redirect(HOME[profiles[0].role]);
  return { token, profile };
}

/** for server actions: the token of a user with this role, or a 404 (no hint that anything exists) */
export async function actionToken(role: Role) {
  const { token, profiles } = await currentProfiles();
  if (!token || !profiles.length) redirect("/login");
  if (!profiles.some((p) => p.role === role)) notFound();
  return token;
}

export const cookieSecure = () => process.env.COOKIE_SECURE === "true" || process.env.VERCEL === "1";
