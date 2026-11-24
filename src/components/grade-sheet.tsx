"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { saveGrades } from "@/lib/actions/grades";
import { COMPONENT_LABEL, finalScore, weightSum, type GradeComponent, type Weights } from "@/lib/grades";
import { SubmitButton } from "./submit-button";

type Column = {
  id: string;
  title: string;
  component: GradeComponent;
  maxScore: number;
};

type Row = {
  studentId: string;
  nis: string;
  name: string;
  scores: Record<string, number | null>;
};

export function GradeSheet({
  teachingId,
  columns,
  rows,
  initialWeights,
}: {
  teachingId: string;
  columns: Column[];
  rows: Row[];
  initialWeights: Weights;
}) {
  const [state, action] = useActionState(saveGrades, null);
  const [weights, setWeights] = useState(initialWeights);
  const [scores, setScores] = useState(rows);
  const total = weightSum(weights);
  const payload = useMemo(
    () =>
      JSON.stringify({
        teachingId,
        weights,
        scores: scores.flatMap((row) =>
          columns.map((column) => ({
            studentId: row.studentId,
            assignmentId: column.id,
            score: row.scores[column.id] ?? null,
          })),
        ),
      }),
    [columns, scores, teachingId, weights],
  );

  function setWeight(key: keyof Weights, value: string) {
    const next = Number(value);
    setWeights((current) => ({ ...current, [key]: Number.isFinite(next) ? next : 0 }));
  }

  function setScore(studentId: string, assignmentId: string, value: string) {
    setScores((current) =>
      current.map((row) => {
        if (row.studentId !== studentId) return row;
        if (value === "") return { ...row, scores: { ...row.scores, [assignmentId]: null } };
        const score = Number(value);
        return { ...row, scores: { ...row.scores, [assignmentId]: Number.isFinite(score) ? score : null } };
      }),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-3 border border-line bg-raised p-3 sm:grid-cols-4">
        {(Object.keys(COMPONENT_LABEL) as GradeComponent[]).map((key) => (
          <label key={key} className="text-sm">
            Bobot {COMPONENT_LABEL[key]}
            <input
              type="number"
              min={0}
              max={100}
              value={weights[key]}
              onChange={(event) => setWeight(key, event.target.value)}
              className="mt-1 w-full border border-line bg-paper px-2 py-2"
            />
          </label>
        ))}
      </div>
      <p className={`text-sm ${total === 100 ? "text-leaf" : "text-stamp"}`}>Jumlah bobot {total}. Harus 100.</p>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-paper text-left">
            <tr>
              <th className="sticky left-0 bg-paper px-3 py-2 font-medium">Murid</th>
              {columns.map((column) => (
                <th key={column.id} className="px-3 py-2 font-medium">
                  <span className="block text-xs text-brass">{COMPONENT_LABEL[column.component]}</span>
                  {column.title}
                  <span className="block font-normal text-ink-soft">maks {column.maxScore}</span>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Nilai akhir</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((row) => {
              const akhir = finalScore(
                columns
                  .filter((column) => row.scores[column.id] !== null && row.scores[column.id] !== undefined)
                  .map((column) => ({
                    component: column.component,
                    score: row.scores[column.id] as number,
                    maxScore: column.maxScore,
                  })),
                weights,
              );
              return (
                <tr key={row.studentId} className="border-t border-line">
                  <th className="sticky left-0 bg-raised px-3 py-2 text-left font-normal" scope="row">
                    <span className="block">{row.name}</span>
                    <span className="font-mono text-xs text-ink-soft">{row.nis}</span>
                  </th>
                  {columns.map((column) => (
                    <td key={column.id} className="px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        max={column.maxScore}
                        value={row.scores[column.id] ?? ""}
                        onChange={(event) => setScore(row.studentId, column.id, event.target.value)}
                        aria-label={`${row.name} ${column.title}`}
                        className="w-20 border border-line bg-paper px-2 py-1"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 font-medium">{akhir === null ? "—" : akhir.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {state?.error ? <p className="text-sm text-stamp">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-leaf">{state.ok}</p> : null}
      <SubmitButton label="Simpan buku nilai" />
    </form>
  );
}
