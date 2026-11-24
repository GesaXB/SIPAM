"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, requireRole } from "../auth";
import { db } from "../db";
import { guardians, loans, messages, notes, notifications, students } from "../db/schema";
import { childrenOf, studentProfile, teacherCanAccessClass } from "../queries";

function newId() {
  return crypto.randomUUID();
}

export async function extendLoan(formData: FormData) {
  const session = await requireRole("murid");
  const profile = await studentProfile(session.id);
  const loanId = String(formData.get("loanId") ?? "");
  if (!profile) return;
  const rows = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.studentId, profile.studentId)))
    .limit(1);
  const loan = rows[0];
  if (!loan || loan.returnedAt) return;
  if (loan.extensionCount >= 2) return;
  const due = new Date(loan.dueAt);
  due.setDate(due.getDate() + 7);
  await db
    .update(loans)
    .set({ dueAt: due, extensionCount: loan.extensionCount + 1 })
    .where(eq(loans.id, loan.id));
  revalidatePath("/murid/pinjam");
}

export async function returnLoan(formData: FormData) {
  const session = await requireRole("murid");
  const profile = await studentProfile(session.id);
  const loanId = String(formData.get("loanId") ?? "");
  if (!profile) return;
  await db
    .update(loans)
    .set({ returnedAt: new Date() })
    .where(and(eq(loans.id, loanId), eq(loans.studentId, profile.studentId), isNull(loans.returnedAt)));
  revalidatePath("/murid/pinjam");
}

const messageSchema = z.object({
  studentId: z.string().min(1),
  body: z.string().trim().min(2).max(1000),
});

export async function sendParentMessage(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
) {
  const session = await requireRole("orangtua");
  const parsed = messageSchema.safeParse({
    studentId: formData.get("studentId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Tulis pesan yang ingin disampaikan ke sekolah." };
  const children = await childrenOf(session.id);
  const child = children.find((row) => row.studentId === parsed.data.studentId);
  if (!child) return { error: "Anda hanya dapat mengirim pesan untuk anak yang tertaut pada akun ini." };

  await db.insert(messages).values({
    id: newId(),
    senderId: session.id,
    recipientId: child.homeroomTeacherId,
    studentId: child.studentId,
    body: parsed.data.body,
  });
  await db.insert(notifications).values({
    id: newId(),
    userId: child.homeroomTeacherId,
    title: "Pesan dari orang tua",
    body: `${session.name} mengirim pesan tentang ${child.name}.`,
    href: "/guru/pesan",
  });
  revalidatePath("/orangtua/pesan");
  revalidatePath("/guru/pesan");
  return { ok: "Pesan terkirim ke wali kelas." };
}

export async function sendTeacherReply(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
) {
  const session = await requireRole("guru");
  const parsed = messageSchema.safeParse({
    studentId: formData.get("studentId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Tulis balasan terlebih dahulu." };
  const studentRows = await db
    .select({ classId: students.classId })
    .from(students)
    .where(eq(students.id, parsed.data.studentId))
    .limit(1);
  const student = studentRows[0];
  if (!student || !(await teacherCanAccessClass(session.id, student.classId))) {
    return { error: "Murid ini tidak berada di kelas yang Anda ampu." };
  }
  const parents = await db
    .select({ parentUserId: guardians.parentUserId })
    .from(guardians)
    .where(eq(guardians.studentId, parsed.data.studentId));
  if (parents.length === 0) return { error: "Murid ini belum memiliki akun orang tua." };

  await db.insert(messages).values(
    parents.map((parent) => ({
      id: newId(),
      senderId: session.id,
      recipientId: parent.parentUserId,
      studentId: parsed.data.studentId,
      body: parsed.data.body,
    })),
  );
  await db.insert(notifications).values(
    parents.map((parent) => ({
      id: newId(),
      userId: parent.parentUserId,
      title: "Balasan dari sekolah",
      body: `${session.name} membalas pesan Anda.`,
      href: "/orangtua/pesan",
    })),
  );
  revalidatePath("/guru/pesan");
  revalidatePath("/orangtua/pesan");
  return { ok: "Balasan terkirim ke orang tua." };
}

const noteSchema = z.object({
  classId: z.string().min(1),
  studentId: z.string().optional(),
  kind: z.enum(["pengumuman", "prestasi", "pelanggaran"]),
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(3).max(1000),
});

export async function publishNote(_prev: { error?: string; ok?: string } | null, formData: FormData) {
  const session = await requireRole("guru");
  const parsed = noteSchema.safeParse({
    classId: formData.get("classId"),
    studentId: String(formData.get("studentId") ?? "") || undefined,
    kind: formData.get("kind"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Lengkapi jenis, judul, dan isi catatan." };
  if (!(await teacherCanAccessClass(session.id, parsed.data.classId))) {
    return { error: "Kelas ini bukan kelas yang Anda ampu." };
  }

  let studentId: string | null = null;
  if (parsed.data.studentId) {
    const match = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, parsed.data.studentId), eq(students.classId, parsed.data.classId)))
      .limit(1);
    if (!match[0]) return { error: "Murid tidak ada di kelas tersebut." };
    studentId = match[0].id;
  }

  await db.insert(notes).values({
    id: newId(),
    authorId: session.id,
    classId: parsed.data.classId,
    studentId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body,
  });

  const targets = await db
    .select({ id: students.id, userId: students.userId })
    .from(students)
    .where(
      studentId
        ? eq(students.id, studentId)
        : eq(students.classId, parsed.data.classId),
    );
  const parents = await db
    .select({ parentUserId: guardians.parentUserId })
    .from(guardians)
    .where(
      inArray(
        guardians.studentId,
        targets.map((row) => row.id),
      ),
    );
  const label =
    parsed.data.kind === "pengumuman"
      ? "Pengumuman sekolah"
      : parsed.data.kind === "prestasi"
        ? "Catatan prestasi"
        : "Catatan khusus";
  const notices = [
    ...targets.map((row) => ({
      id: newId(),
      userId: row.userId,
      title: label,
      body: parsed.data.title,
      href: "/murid",
    })),
    ...parents.map((parent) => ({
      id: newId(),
      userId: parent.parentUserId,
      title: label,
      body: parsed.data.title,
      href: "/orangtua/catatan",
    })),
  ];
  if (notices.length > 0) await db.insert(notifications).values(notices);

  revalidatePath("/guru/pengumuman");
  revalidatePath("/orangtua/catatan");
  revalidatePath("/murid");
  return { ok: "Catatan terkirim ke murid dan orang tua yang berhak." };
}

export async function markNotificationsRead() {
  const session = await getSession();
  if (!session) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.id), isNull(notifications.readAt)));
  revalidatePath("/murid/notifikasi");
  revalidatePath("/orangtua/notifikasi");
  revalidatePath("/guru/notifikasi");
}
