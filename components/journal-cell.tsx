"use client";
// A journal cell: Enter or leaving the field saves it (the form posts like without JavaScript).
import { useFormStatus } from "react-dom";

export function CellInput({ id, value, label, invalid }: { id: string; value: number | null; label: string; invalid?: boolean }) {
  const { pending } = useFormStatus();
  return <input id={id} name="score" type="number" min={0} max={100} inputMode="numeric" defaultValue={value ?? ""} aria-label={label}
    aria-invalid={invalid || undefined} disabled={pending} className={pending ? "saving" : undefined}
    onBlur={(e) => { const v = e.currentTarget.value; if (v !== "" && v !== String(value ?? "")) e.currentTarget.form?.requestSubmit(); }} />;
}
