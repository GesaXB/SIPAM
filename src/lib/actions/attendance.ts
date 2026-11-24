"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../auth";
import { db } from "../db";
import {
  attendanceCodes,
  attendances,
  guardians,
  notifications,
  students,
  users,
} from "../db/schema";
import { teacherCanAccessClass, studentProfile } from "../queries";
import { isSchoolHours, jakartaDate } from "../time";

function newId() {
  return crypto.randomUUID();
}

const attendanceSchema = z.object({
  classId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["hadir", "izin", "sakit", "alpa"]),
    }),
  ),
});

export async function saveAttendance(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
) {
  const session = await requireRole("guru");
  const parsed = attendanceSchema.safeParse(JSON.parse(String(formData.get("payload") ?? "{}")));
  if (!parsed.success) return { error: "Data presensi tidak lengkap." };
  const { classId, date, records } = parsed.data;
  if (!(await teacherCanAccessClass(session.id, classId))) {
    return { error: "Kelas ini bukan kelas yang Anda ampu." };
  }
  if (records.length === 0) return { error: "Tidak ada murid pada kelas ini." };

  const roster = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.classId, classId),
        inArray(
          students.id,
          records.map((record) => record.studentId),
        ),
      ),
    );
  const allowed = new Set(roster.map((row) => row.id));
  const rows = records.filter((record) => allowed.has(record.studentId));

  await db
    .insert(attendances)
    .values(
      rows.map((record) => ({
        id: newId(),
        studentId: record.studentId,
        date,
        status: record.status,
        source: "guru" as const,
        recordedBy: session.id,
      })),
    )
    .onConflictDoUpdate({
      target: [attendances.studentId, attendances.date],
      set: {
        status: sql`excluded.status`,
        source: sql`excluded.source`,
        recordedBy: sql`excluded.recorded_by`,
      },
    });

  const absent = rows.filter((record) => record.status === "alpa").map((record) => record.studentId);
  if (absent.length > 0) {
    const parents = await db
      .select({ parentUserId: guardians.parentUserId, studentId: guardians.studentId })
      .from(guardians)
      .where(inArray(guardians.studentId, absent));
    const studentNames = await db
      .select({ id: students.id, name: users.name })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(inArray(students.id, absent));
    const nameOf = new Map(studentNames.map((row) => [row.id, row.name]));
    if (parents.length > 0) {
      await db.insert(notifications).values(
        parents.map((parent) => ({
          id: newId(),
          userId: parent.parentUserId,
          title: "Anak tercatat alpa",
          body: `${nameOf.get(parent.studentId) ?? "Anak"} tidak hadir pada ${date}.`,
          href: "/orangtua/presensi",
        })),
      );
    }
  }

  revalidatePath("/guru/presensi");
  revalidatePath("/orangtua/presensi");
  revalidatePath("/murid");
  return { ok: `Presensi ${rows.length} murid tersimpan. Orang tua murid alpa sudah diberi tahu.` };
}

const scanSchema = z.object({
  code: z.string().trim().min(4).max(40),
});

export async function selfScan(_prev: { error?: string; ok?: string } | null, formData: FormData) {
  const session = await requireRole("murid");
  if (!isSchoolHours()) {
    return {
      error:
        "Pemindaian mandiri hanya dibuka Senin–Jumat pukul 06.30–15.30 WIB. Di luar jam sekolah kehadiran tidak dicatat dari perangkat murid.",
    };
  }
  const parsed = scanSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Masukkan kode dari papan guru." };

  const profile = await studentProfile(session.id);
  if (!profile) return { error: "Data murid tidak ditemukan." };
  const today = jakartaDate();
  const raw = parsed.data.code.toUpperCase().replace(/^SIPAM:/, "").trim();
  const codes = await db
    .select()
    .from(attendanceCodes)
    .where(and(eq(attendanceCodes.classId, profile.classId), eq(attendanceCodes.date, today)))
    .limit(1);
  if (!codes[0] || codes[0].code !== raw) {
    return { error: "Kode tidak sesuai dengan kelas hari ini." };
  }

  const existing = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.studentId, profile.studentId), eq(attendances.date, today)))
    .limit(1);
  if (existing[0]?.status === "izin" || existing[0]?.status === "sakit") {
    return { error: "Status hari ini sudah dicatat guru. Hubungi wali kelas bila perlu diubah." };
  }
  if (existing[0]?.status === "hadir") {
    return { ok: "Kehadiran hari ini sudah tercatat." };
  }

  await db
    .insert(attendances)
    .values({
      id: newId(),
      studentId: profile.studentId,
      date: today,
      status: "hadir",
      source: "mandiri",
      recordedBy: session.id,
    })
    .onConflictDoUpdate({
      target: [attendances.studentId, attendances.date],
      set: { status: "hadir", source: "mandiri", recordedBy: session.id },
    });

  revalidatePath("/murid");
  revalidatePath("/murid/presensi");
  return { ok: "Kehadiran tercatat. Hanya aktivitas di jam sekolah yang masuk ke buku ini." };
}
