import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["murid", "orangtua", "guru"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "hadir",
  "izin",
  "sakit",
  "alpa",
]);
export const attendanceSourceEnum = pgEnum("attendance_source", ["mandiri", "guru"]);
export const gradeComponentEnum = pgEnum("grade_component", [
  "tugas",
  "ulangan",
  "uts",
  "uas",
]);
export const itemCategoryEnum = pgEnum("item_category", ["buku", "lab", "lain"]);
export const noteKindEnum = pgEnum("note_kind", [
  "pengumuman",
  "prestasi",
  "pelanggaran",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  academicYear: text("academic_year").notNull(),
  homeroomTeacherId: text("homeroom_teacher_id")
    .notNull()
    .references(() => users.id),
});

export const students = pgTable("students", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  nis: text("nis").notNull().unique(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
});

export const guardians = pgTable(
  "guardians",
  {
    id: text("id").primaryKey(),
    parentUserId: text("parent_user_id")
      .notNull()
      .references(() => users.id),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    relation: text("relation").notNull(),
  },
  (table) => [
    uniqueIndex("guardians_parent_student").on(table.parentUserId, table.studentId),
  ],
);

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
});

export const teachings = pgTable(
  "teachings",
  {
    id: text("id").primaryKey(),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => users.id),
    weightTugas: integer("weight_tugas").notNull(),
    weightUlangan: integer("weight_ulangan").notNull(),
    weightUts: integer("weight_uts").notNull(),
    weightUas: integer("weight_uas").notNull(),
  },
  (table) => [
    uniqueIndex("teachings_class_subject").on(table.classId, table.subjectId),
  ],
);

export const schedules = pgTable("schedules", {
  id: text("id").primaryKey(),
  teachingId: text("teaching_id")
    .notNull()
    .references(() => teachings.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room").notNull(),
});

export const attendanceCodes = pgTable(
  "attendance_codes",
  {
    id: text("id").primaryKey(),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
    date: date("date", { mode: "string" }).notNull(),
    code: text("code").notNull(),
  },
  (table) => [uniqueIndex("attendance_codes_class_date").on(table.classId, table.date)],
);

export const attendances = pgTable(
  "attendances",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    date: date("date", { mode: "string" }).notNull(),
    status: attendanceStatusEnum("status").notNull(),
    source: attendanceSourceEnum("source").notNull(),
    recordedBy: text("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("attendances_student_date").on(table.studentId, table.date)],
);

export const assignments = pgTable("assignments", {
  id: text("id").primaryKey(),
  teachingId: text("teaching_id")
    .notNull()
    .references(() => teachings.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  component: gradeComponentEnum("component").notNull(),
  maxScore: integer("max_score").notNull().default(100),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const grades = pgTable(
  "grades",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
  },
  (table) => [
    uniqueIndex("grades_assignment_student").on(table.assignmentId, table.studentId),
  ],
);

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: itemCategoryEnum("category").notNull(),
  code: text("code").notNull().unique(),
});

export const loans = pgTable("loans", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  borrowedAt: timestamp("borrowed_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  extensionCount: integer("extension_count").notNull().default(0),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => users.id),
  recipientId: text("recipient_id")
    .notNull()
    .references(() => users.id),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  classId: text("class_id").references(() => classes.id),
  studentId: text("student_id").references(() => students.id),
  kind: noteKindEnum("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  users,
  classes,
  students,
  guardians,
  subjects,
  teachings,
  schedules,
  attendanceCodes,
  attendances,
  assignments,
  grades,
  items,
  loans,
  messages,
  notes,
  notifications,
};
