import { compare, hash } from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "sipam_session";

export type Role = "murid" | "orangtua" | "guru";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET belum diisi.");
  return new TextEncoder().encode(value);
}

export function homePath(role: Role) {
  if (role === "murid") return "/murid";
  if (role === "orangtua") return "/orangtua";
  return "/guru";
}

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role;
    if (role !== "murid" && role !== "orangtua" && role !== "guru") return null;
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireRole(role: Role) {
  const session = await getSession();
  if (!session) redirect("/masuk");
  if (session.role !== role) redirect(homePath(session.role));
  return session;
}
