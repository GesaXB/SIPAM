"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../auth";
import { db } from "../db";
import { assignments, grades, guardians, notifications, students, teachings } from "../db/schema";
import { weightSum, type GradeComponent } from "../grades";

function newId() {
  return crypto.randomUUID();
}

const gradeSchema = z.object({
  teachingId: z.string().min(1),
  weights: z.object({
    tugas: z.number().int().min(0).max(100),
    ulangan: z.number().int().min(0).max(100),
    uts: z.number().int().min(0).max(100),
    uas: z.number().int().min(0).max(100),
  }),
  scores: z.array(
    z.object({
      studentId: z.string(),
      assignmentId: z.string(),
      score: z.number().int().min(0).nullable(),
    }),
  ),
});

async function ownTeaching(teacherId: string, teachingId: string) {
  const rows = await db
    .select()
    .from(teachings)
    .where(and(eq(teachings.id, teachingId), eq(teachings.teacherId, teacherId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveGrades(_prev: { error?: string; ok?: string } | null, formData: FormData) {
  const session = await requireRole("guru");
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Data nilai tidak terbaca." };
  }
  const parsed = gradeSchema.safeParse(payload);
  if (!parsed.success) return { error: "Periksa kembali angka nilai dan bobot." };
  if (weightSum(parsed.data.weights) !== 100) {
    return { error: "Jumlah bobot tugas, ulangan, UTS, dan UAS harus 100." };
  }
  const teaching = await ownTeaching(session.id, parsed.data.teachingId);
  if (!teaching) return { error: "Mata pelajaran ini bukan bagian Anda." };

  const assignmentRows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.teachingId, teaching.id));
  const assignmentMap = new Map(assignmentRows.map((row) => [row.id, row]));
  const roster = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.classId, teaching.classId));
  const rosterIds = new Set(roster.map((row) => row.id));

  await db
    .update(teachings)
    .set({
      weightTugas: parsed.data.weights.tugas,
      weightUlangan: parsed.data.weights.ulangan,
      weightUts: parsed.data.weights.uts,
      weightUas: parsed.data.weights.uas,
    })
    .where(eq(teachings.id, teaching.id));

  for (const entry of parsed.data.scores) {
    const assignment = assignmentMap.get(entry.assignmentId);
    if (!assignment || !rosterIds.has(entry.studentId)) continue;
    if (entry.score === null) {
      await db
        .delete(grades)
        .where(and(eq(grades.assignmentId, entry.assignmentId), eq(grades.studentId, entry.studentId)));
      continue;
    }
    if (entry.score > assignment.maxScore) {
      return { error: `Nilai ${assignment.title} melebihi batas ${assignment.maxScore}.` };
    }
    await db
      .insert(grades)
      .values({
        id: newId(),
        assignmentId: entry.assignmentId,
        studentId: entry.studentId,
        score: entry.score,
      })
      .onConflictDoUpdate({
        target: [grades.assignmentId, grades.studentId],
        set: { score: entry.score },
      });
  }

  revalidatePath("/guru/nilai");
  revalidatePath("/murid/nilai");
  revalidatePath("/orangtua/nilai");
  return { ok: "Nilai dan bobot tersimpan. Nilai akhir dihitung dari bobot yang ada nilainya." };
}

const assignmentSchema = z.object({
  teachingId: z.string().min(1),
  title: z.string().trim().min(3).max(80),
  component: z.enum(["tugas", "ulangan", "uts", "uas"]),
  maxScore: z.coerce.number().int().min(1).max(100),
  dueAt: z.string().optional(),
});

export async function addAssignment(_prev: { error?: string; ok?: string } | null, formData: FormData) {
  const session = await requireRole("guru");
  const parsed = assignmentSchema.safeParse({
    teachingId: formData.get("teachingId"),
    title: formData.get("title"),
    component: formData.get("component"),
    maxScore: formData.get("maxScore"),
    dueAt: formData.get("dueAt") || undefined,
  });
  if (!parsed.success) return { error: "Lengkapi judul, jenis, dan nilai maksimal." };
  const teaching = await ownTeaching(session.id, parsed.data.teachingId);
  if (!teaching) return { error: "Mata pelajaran ini bukan bagian Anda." };

  const dueAt = parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T16:00:00+07:00`) : null;
  await db.insert(assignments).values({
    id: newId(),
    teachingId: teaching.id,
    title: parsed.data.title,
    component: parsed.data.component as GradeComponent,
    maxScore: parsed.data.maxScore,
    dueAt,
    description: "",
  });

  if (dueAt) {
    const roster = await db
      .select({ id: students.id, userId: students.userId })
      .from(students)
      .where(eq(students.classId, teaching.classId));
    const parents = await db
      .select({ parentUserId: guardians.parentUserId })
      .from(guardians)
      .where(
        inArray(
          guardians.studentId,
          roster.map((row) => row.id),
        ),
      );
    const noteRows = [
      ...roster.map((row) => ({
        id: newId(),
        userId: row.userId,
        title: "Tugas baru",
        body: `${parsed.data.title} masuk ke daftar tugas.`,
        href: "/murid/tugas",
      })),
      ...parents.map((parent) => ({
        id: newId(),
        userId: parent.parentUserId,
        title: "Ada tugas baru",
        body: `${parsed.data.title} ditambahkan guru.`,
        href: "/orangtua/nilai",
      })),
    ];
    if (noteRows.length > 0) await db.insert(notifications).values(noteRows);
  }

  revalidatePath("/guru/nilai");
  revalidatePath("/murid/tugas");
  return { ok: "Kolom penilaian ditambahkan." };
}

export async function importGrades(_prev: { error?: string; ok?: string } | null, formData: FormData) {
  const session = await requireRole("guru");
  const teachingId = String(formData.get("teachingId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih berkas .xlsx terlebih dahulu." };
  const teaching = await ownTeaching(session.id, teachingId);
  if (!teaching) return { error: "Mata pelajaran ini bukan bagian Anda." };

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "Lembar kerja kosong." };

  const header: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    header[col] = String(cell.value ?? "").trim();
  });
  const nisCol = header.findIndex((value) => value.toLowerCase() === "nis");
  if (nisCol < 0) return { error: "Kolom NIS tidak ditemukan. Unduh templat dari tombol ekspor." };

  const assignmentRows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.teachingId, teaching.id));
  const byTitle = new Map(assignmentRows.map((row) => [row.title, row]));
  const roster = await db
    .select({ id: students.id, nis: students.nis })
    .from(students)
    .where(eq(students.classId, teaching.classId));
  const byNis = new Map(roster.map((row) => [row.nis, row.id]));

  let updated = 0;
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const nis = String(row.getCell(nisCol).value ?? "").trim();
    const studentId = byNis.get(nis);
    if (!studentId) continue;
    for (let col = 1; col < header.length; col += 1) {
      const title = header[col];
      const assignment = title ? byTitle.get(title) : undefined;
      if (!assignment) continue;
      const raw = row.getCell(col).value;
      if (raw === null || raw === undefined || raw === "") continue;
      const score = Number(raw);
      if (!Number.isInteger(score) || score < 0 || score > assignment.maxScore) {
        return { error: `Nilai baris ${rowIndex} untuk ${title} tidak valid.` };
      }
      await db
        .insert(grades)
        .values({ id: newId(), assignmentId: assignment.id, studentId, score })
        .onConflictDoUpdate({
          target: [grades.assignmentId, grades.studentId],
          set: { score },
        });
      updated += 1;
    }
  }

  revalidatePath("/guru/nilai");
  revalidatePath("/murid/nilai");
  revalidatePath("/orangtua/nilai");
  return { ok: `${updated} sel nilai diimpor dari spreadsheet.` };
}
