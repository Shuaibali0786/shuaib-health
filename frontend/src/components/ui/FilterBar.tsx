import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { IconName } from "@/types/content";
import { ICONS } from "./icons";

/**
 * Labelled filter controls shared by the Doctors, Lab Tests and Health Tips pages. Every control
 * has a visible label, targets are at least 44 px tall, and the result count is announced
 * politely so screen-reader users hear the list change.
 */

const FIELD_CLASS =
  "min-h-11 w-full rounded-control border border-border-strong bg-white px-3 text-base text-ink placeholder:text-muted";

export function FilterBar({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  // A div with role="search" (not a form): Enter in the search box must not submit or reload.
  return (
    <div role="search" aria-label={label} className={cn("flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end", className)}>
      {children}
    </div>
  );
}

interface SearchFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchField({ id, label, value, onChange, placeholder }: SearchFieldProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-56">
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        {label}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
    </div>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function SelectField({ id, label, value, onChange, options }: SelectFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:min-w-48">
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ChipGroupProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; count?: number; iconName?: IconName }>;
}

/** Single-choice chips as toggle buttons. The selected chip has `aria-pressed="true"` and a filled look. */
export function ChipGroup({ label, value, onChange, options }: ChipGroupProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.iconName ? ICONS[option.iconName] : null;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-pill border-2 px-4 text-sm font-semibold transition-colors",
              selected ? "border-navy-900 bg-navy-900 text-white" : "border-border-strong bg-white text-navy-900 hover:bg-surface",
            )}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            {typeof option.count === "number" ? `${option.label} (${option.count})` : option.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Showing 3 of 9 doctors", announced politely when it changes. */
export function ResultCount({ shown, total, noun, className }: { shown: number; total: number; noun: string; className?: string }) {
  const text = shown === total ? `Showing all ${total} ${noun}` : `Showing ${shown} of ${total} ${noun}`;
  return (
    <p role="status" aria-live="polite" className={cn("text-sm text-muted", className)}>
      {text}
    </p>
  );
}
