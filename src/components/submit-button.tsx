"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 bg-leaf px-4 text-sm font-medium text-paper disabled:opacity-60"
    >
      {pending ? (pendingLabel ?? "Menyimpan...") : label}
    </button>
  );
}
