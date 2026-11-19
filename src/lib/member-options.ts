/** Shared by the form, server validation and member/receipt displays. */
export function isLockerExtra(name: string) {
  return /\blockers?\b/i.test(name);
}

export function shiftLabel(shift: string | null | undefined) {
  return shift === "MORNING" ? "Morning" : shift === "EVENING" ? "Evening" : "Not set";
}

export function normalizeLockerNumber(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : normalized;
}

export function validateLockerNumbers(
  extras: { id: string; name: string }[],
  input: Record<string, string>
) {
  const numbers: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const extra of extras) {
    if (!isLockerExtra(extra.name)) continue;
    const value = normalizeLockerNumber(input[extra.id] ?? "");
    if (!value) errors[`lockerNumber:${extra.id}`] = "Enter a locker number.";
    else if (value.length > 40 || /[\x00-\x1f\x7f]/.test(value))
      errors[`lockerNumber:${extra.id}`] = "Use a locker number up to 40 characters.";
    else if (seen.has(value))
      errors[`lockerNumber:${extra.id}`] = `Locker ${value} is already selected in this form.`;
    else {
      numbers[extra.id] = value;
      seen.add(value);
    }
  }
  return { numbers, errors };
}
