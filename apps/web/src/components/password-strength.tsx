import { passwordStrength } from "@/lib/password-policy";

const FILL = ["bg-red-500", "bg-amber-500", "bg-teal-500", "bg-emerald-600"];

export function PasswordStrength({ password }: { password: string }) {
  const strength = passwordStrength(password);
  if (strength.level === "empty") return null;
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1.5 flex-1 rounded-full ${step <= strength.score ? FILL[strength.score - 1] : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Strength: {strength.label}. Use 8+ characters with upper and lower case, a number, and a symbol.
      </p>
    </div>
  );
}
