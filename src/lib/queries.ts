import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "./db";
import {
  assignments,
  attendances,
  classes,
  grades,
  guardians,
  items,
  loans,
  messages,
  notes,
  notifications,
  schedules,
  students,
  subjects,
  teachings,
  users,
} from "./db/schema";

export async function studentProfile(userId: string) {
  const rows = await db
    .select({
      studentId: students.id,
      nis: students.nis,
      classId: students.classId,
      className: classes.name,
      academicYear: classes.academicYear,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomName: users.name,
    })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(users, eq(classes.homeroomTeacherId, users.id))
    .where(eq(students.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function childrenOf(parentUserId: string) {
  const rows = await db
    .select({
      studentId: students.id,
      name: users.name,
      nis: students.nis,
      classId: students.classId,
      className: classes.name,
      academicYear: classes.academicYear,
      homeroomTeacherId: classes.homeroomTeacherId,
    })
    .from(guardians)
    .innerJoin(students, eq(guardians.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(eq(guardians.parentUserId, parentUserId));

  const teacherIds = [...new Set(rows.map((row) => row.homeroomTeacherId))];
  const teachers =
    teacherIds.length === 0
      ? []
      : await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, teacherIds));
  const teacherName = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  return rows.map((row) => ({
    ...row,
    homeroomName: teacherName.get(row.homeroomTeacherId) ?? "Wali kelas",
  }));
}

export async function classesForTeacher(teacherId: string) {
  const homeroom = await db
    .select({ id: classes.id, name: classes.name, academicYear: classes.academicYear })
    .from(classes)
    .where(eq(classes.homeroomTeacherId, teacherId));
  const taught = await db
    .select({ id: classes.id, name: classes.name, academicYear: classes.academicYear })
    .from(teachings)
    .innerJoin(classes, eq(teachings.classId, classes.id))
    .where(eq(teachings.teacherId, teacherId));
  const map = new Map<string, (typeof homeroom)[number]>();
  for (const row of [...homeroom, ...taught]) map.set(row.id, row);
  return [...map.values()];
}

export async function teacherCanAccessClass(teacherId: string, classId: string) {
  const allowed = await classesForTeacher(teacherId);
  return allowed.some((row) => row.id === classId);
}

export async function teachingsForTeacher(teacherId: string) {
  return db
    .select({
      id: teachings.id,
      classId: teachings.classId,
      className: classes.name,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      weightTugas: teachings.weightTugas,
      weightUlangan: teachings.weightUlangan,
      weightUts: teachings.weightUts,
      weightUas: teachings.weightUas,
    })
    .from(teachings)
    .innerJoin(classes, eq(teachings.classId, classes.id))
    .innerJoin(subjects, eq(teachings.subjectId, subjects.id))
    .where(eq(teachings.teacherId, teacherId));
}

export async function classRoster(classId: string) {
  return db
    .select({
      studentId: students.id,
      userId: students.userId,
      nis: students.nis,
      name: users.name,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .where(eq(students.classId, classId))
    .orderBy(users.name);
}

export async function timetable(classId: string) {
  return db
    .select({
      id: schedules.id,
      dayOfWeek: schedules.dayOfWeek,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      room: schedules.room,
      subjectName: subjects.name,
      teacherName: users.name,
    })
    .from(schedules)
    .innerJoin(teachings, eq(schedules.teachingId, teachings.id))
    .innerJoin(subjects, eq(teachings.subjectId, subjects.id))
    .innerJoin(users, eq(teachings.teacherId, users.id))
    .where(eq(teachings.classId, classId))
    .orderBy(schedules.dayOfWeek, schedules.startTime);
}

export async function attendanceForStudent(studentId: string, limit = 14) {
  return db
    .select()
    .from(attendances)
    .where(eq(attendances.studentId, studentId))
    .orderBy(desc(attendances.date))
    .limit(limit);
}

export async function attendanceOn(studentId: string, date: string) {
  const rows = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.studentId, studentId), eq(attendances.date, date)))
    .limit(1);
  return rows[0] ?? null;
}

export async function classAttendance(classId: string, date: string) {
  const roster = await classRoster(classId);
  const ids = roster.map((row) => row.studentId);
  const marks =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(attendances)
          .where(and(inArray(attendances.studentId, ids), eq(attendances.date, date)));
  const byStudent = new Map(marks.map((mark) => [mark.studentId, mark]));
  return roster.map((row) => ({ ...row, mark: byStudent.get(row.studentId) ?? null }));
}

export async function assignmentsForClass(classId: string) {
  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      component: assignments.component,
      maxScore: assignments.maxScore,
      dueAt: assignments.dueAt,
      subjectName: subjects.name,
      teachingId: teachings.id,
    })
    .from(assignments)
    .innerJoin(teachings, eq(assignments.teachingId, teachings.id))
    .innerJoin(subjects, eq(teachings.subjectId, subjects.id))
    .where(eq(teachings.classId, classId))
    .orderBy(assignments.dueAt);
}

export async function gradesForStudent(studentId: string) {
  return db
    .select({
      assignmentId: grades.assignmentId,
      score: grades.score,
      title: assignments.title,
      component: assignments.component,
      maxScore: assignments.maxScore,
      dueAt: assignments.dueAt,
      subjectName: subjects.name,
      teachingId: teachings.id,
      weightTugas: teachings.weightTugas,
      weightUlangan: teachings.weightUlangan,
      weightUts: teachings.weightUts,
      weightUas: teachings.weightUas,
    })
    .from(assignments)
    .innerJoin(teachings, eq(assignments.teachingId, teachings.id))
    .innerJoin(subjects, eq(teachings.subjectId, subjects.id))
    .leftJoin(
      grades,
      and(eq(grades.assignmentId, assignments.id), eq(grades.studentId, studentId)),
    )
    .orderBy(subjects.name, assignments.component);
}

export async function loansForStudent(studentId: string) {
  return db
    .select({
      id: loans.id,
      borrowedAt: loans.borrowedAt,
      dueAt: loans.dueAt,
      returnedAt: loans.returnedAt,
      extensionCount: loans.extensionCount,
      itemName: items.name,
      category: items.category,
      code: items.code,
    })
    .from(loans)
    .innerJoin(items, eq(loans.itemId, items.id))
    .where(eq(loans.studentId, studentId))
    .orderBy(desc(loans.borrowedAt));
}

export async function notesForClass(classId: string, studentId?: string) {
  return db
    .select({
      id: notes.id,
      kind: notes.kind,
      title: notes.title,
      body: notes.body,
      createdAt: notes.createdAt,
      studentId: notes.studentId,
      authorName: users.name,
    })
    .from(notes)
    .innerJoin(users, eq(notes.authorId, users.id))
    .where(
      and(
        eq(notes.classId, classId),
        studentId
          ? or(isNull(notes.studentId), eq(notes.studentId, studentId))
          : undefined,
      ),
    )
    .orderBy(desc(notes.createdAt));
}

export async function threadForStudent(studentId: string) {
  return db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.studentId, studentId))
    .orderBy(messages.createdAt);
}

export async function inboxForTeacher(teacherId: string) {
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      studentId: messages.studentId,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(or(eq(messages.recipientId, teacherId), eq(messages.senderId, teacherId)))
    .orderBy(desc(messages.createdAt));

  const studentIds = [...new Set(rows.map((row) => row.studentId))];
  const studentRows =
    studentIds.length === 0
      ? []
      : await db
          .select({ id: students.id, name: users.name })
          .from(students)
          .innerJoin(users, eq(students.userId, users.id))
          .where(inArray(students.id, studentIds));
  const names = new Map(studentRows.map((row) => [row.id, row.name]));
  return rows.map((row) => ({
    ...row,
    studentName: names.get(row.studentId) ?? "Murid",
  }));
}

export async function userNotifications(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
}

export async function unreadCount(userId: string) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.length;
}

export async function parentsOfStudents(studentIds: string[]) {
  if (studentIds.length === 0) return [];
  return db
    .select({
      parentUserId: guardians.parentUserId,
      studentId: guardians.studentId,
      parentName: users.name,
    })
    .from(guardians)
    .innerJoin(users, eq(guardians.parentUserId, users.id))
    .where(inArray(guardians.studentId, studentIds));
}
