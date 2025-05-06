import React from "react";

export type ThemeOption = { name: string; value: string };

export default function ThemeSelector({
  value,
  onChange,
  options,
  className = "",
  style = {},
  title = "Change code color theme",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ThemeOption[];
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <select
      className={`bg-zinc-800 text-white rounded px-2 py-1 ml-2 ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ minWidth: 120, ...style }}
      title={title}
    >
      {options.map(t => (
        <option key={t.value} value={t.value}>{t.name}</option>
      ))}
    </select>
  );
} 