"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, clearSession, homePath } from "../auth";
import { db } from "../db";
import { users } from "../db/schema";
import { verifyPassword } from "../auth";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Isi email dan kata sandi." };
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email atau kata sandi tidak sesuai." };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
  redirect(homePath(user.role));
}

export async function logoutAction() {
  await clearSession();
  redirect("/masuk");
}
