"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { saveAttendance } from "@/lib/actions/attendance";
import { SubmitButton } from "./submit-button";

const STATUSES = ["hadir", "izin", "sakit", "alpa"] as const;
type Status = (typeof STATUSES)[number];

export function AttendanceSheet({
  classId,
  date,
  rows,
}: {
  classId: string;
  date: string;
  rows: { studentId: string; nis: string; name: string; status: Status | null }[];
}) {
  const [state, action] = useActionState(saveAttendance, null);
  const [marks, setMarks] = useState<Record<string, Status>>(() =>
    Object.fromEntries(rows.map((row) => [row.studentId, row.status ?? "hadir"])),
  );
  const payload = useMemo(
    () =>
      JSON.stringify({
        classId,
        date,
        records: rows.map((row) => ({ studentId: row.studentId, status: marks[row.studentId] ?? "hadir" })),
      }),
    [classId, date, marks, rows],
  );
  const counts = STATUSES.map((status) => ({
    status,
    total: Object.values(marks).filter((value) => value === status).length,
  }));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <div className="flex flex-wrap gap-2 text-sm">
        {counts.map((item) => (
          <span key={item.status} className="border border-line bg-raised px-2 py-1">
            {item.status} {item.total}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-paper text-left">
            <tr>
              <th className="sticky left-0 bg-paper px-3 py-2 font-medium">Murid</th>
              {STATUSES.map((status) => (
                <th key={status} className="px-3 py-2 font-medium capitalize">
                  {status}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.studentId} className="border-t border-line">
                <th className="sticky left-0 bg-raised px-3 py-2 text-left font-normal" scope="row">
                  <span className="block">{row.name}</span>
                  <span className="font-mono text-xs text-ink-soft">{row.nis}</span>
                </th>
                {STATUSES.map((status) => (
                  <td key={status} className="px-3 py-2">
                    <input
                      type="radio"
                      name={row.studentId}
                      checked={marks[row.studentId] === status}
                      onChange={() => setMarks((current) => ({ ...current, [row.studentId]: status }))}
                      aria-label={`${row.name} ${status}`}
                      className="h-5 w-5 accent-leaf"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state?.error ? <p className="text-sm text-stamp">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-leaf">{state.ok}</p> : null}
      <SubmitButton label={`Simpan ${rows.length} murid`} />
    </form>
  );
}
