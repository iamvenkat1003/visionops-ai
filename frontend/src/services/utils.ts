import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const percent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;
export const ms = (value: number | null) =>
  value === null ? "—" : `${Math.round(value)} ms`;
export const date = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
