export const COMPONENTS = ["tugas", "ulangan", "uts", "uas"] as const;
export type GradeComponent = (typeof COMPONENTS)[number];

export const COMPONENT_LABEL: Record<GradeComponent, string> = {
  tugas: "Tugas",
  ulangan: "Ulangan",
  uts: "UTS",
  uas: "UAS",
};

export type Weights = {
  tugas: number;
  ulangan: number;
  uts: number;
  uas: number;
};

export function finalScore(
  scores: { component: GradeComponent; score: number; maxScore: number }[],
  weights: Weights,
) {
  const average = (component: GradeComponent) => {
    const rows = scores.filter((row) => row.component === component);
    if (rows.length === 0) return null;
    const ratio =
      rows.reduce((sum, row) => sum + row.score / row.maxScore, 0) / rows.length;
    return ratio * 100;
  };

  const parts = COMPONENTS.map((component) => ({
    component,
    value: average(component),
    weight: weights[component],
  }));
  const present = parts.filter((part) => part.value !== null && part.weight > 0);
  if (present.length === 0) return null;
  const weightSum = present.reduce((sum, part) => sum + part.weight, 0);
  const total = present.reduce((sum, part) => sum + (part.value ?? 0) * part.weight, 0);
  return Math.round((total / weightSum) * 100) / 100;
}

export function weightSum(weights: Weights) {
  return weights.tugas + weights.ulangan + weights.uts + weights.uas;
}
