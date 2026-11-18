export function RadioGroupField<T extends string>({
  name,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="radio"
            name={name}
            className="accent-primary"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
