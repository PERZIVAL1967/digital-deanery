"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "../lib/changes/auth";
import { accountProfiles, sessionCookie } from "../lib/dal/session";
import { cookieSecure, HOME } from "../lib/guard";

/** Codex's signIn (argon2id, 5 failures per 15 minutes per login), then a redirect by role. */
export async function login(form: FormData) {
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!login) redirect("/login?error=login");
  if (login.length > 80 || !password || password.length > 128) redirect(`/login?error=password&u=${encodeURIComponent(login.slice(0, 80))}`);
  const token = await signIn(login, password);
  if (!token) redirect(`/login?error=password&u=${encodeURIComponent(login)}`);
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: 8 * 3600,
  });
  const [profile] = await accountProfiles(token);
  redirect(profile ? HOME[profile.role] : "/");
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await signOut(token);
  jar.delete(sessionCookie);
  redirect("/login");
}
