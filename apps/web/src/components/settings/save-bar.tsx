import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

export function SaveBar({
  dirty,
  pending,
  error,
  saved,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  pending: boolean;
  error: string;
  saved: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty && !error && !saved) return null;

  return (
    <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-card">
      <p className="text-sm">
        {error ? (
          <span className="text-critical">{error}</span>
        ) : dirty ? (
          <span className="font-medium text-text-primary">You have unsaved changes</span>
        ) : (
          <span className="text-success">Saved.</span>
        )}
      </p>
      <div className="flex gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDiscard} disabled={pending || !dirty}>
          Discard
        </button>
        <button type="button" className={primaryButtonClass} onClick={onSave} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
