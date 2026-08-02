import { CURRENCY_CONFIG, DATE_CONFIG } from "../config/config";

/**
 * Formats a number as Colombian Peso (COP).
 * Example: 15000 -> "$15.000"
 */
export const formatCOP = (value: number, options: Intl.NumberFormatOptions = {}): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "$0";
  }
  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    style: "currency",
    currency: CURRENCY_CONFIG.currency,
    minimumFractionDigits: CURRENCY_CONFIG.minimumFractionDigits,
    maximumFractionDigits: CURRENCY_CONFIG.maximumFractionDigits,
    ...options,
  }).format(value);
};

/**
 * Parses a COP string back into a plain number.
 * Example: "$15.000" -> 15000
 */
export const parseCOP = (value: string | number): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleanString = value
    .replace(/[$\s.]/g, "") // Remove $, spaces, and dots (thousands separator)
    .replace(/,/g, "."); // Replace comma with dot if there are decimals
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formats dates aligned with the Colombian timezone.
 */
export const formatDateCO = (
  value: string | number | Date,
  options: { style?: "short" | "long"; includeTime?: boolean } = {}
): string => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  const style = options.style || "short";
  const includeTime = options.includeTime || false;

  const dateOpts: Intl.DateTimeFormatOptions = {
    timeZone: DATE_CONFIG.timeZone,
    year: "numeric",
    month: style === "short" ? "2-digit" : "long",
    day: "2-digit",
  };

  if (includeTime) {
    dateOpts.hour = "2-digit";
    dateOpts.minute = "2-digit";
    dateOpts.second = "2-digit";
    dateOpts.hour12 = true;
  }

  return new Intl.DateTimeFormat(DATE_CONFIG.locale, dateOpts).format(date);
};

/**
 * Formats datetime.
 */
export const formatDateTimeCO = (value: string | number | Date): string => {
  return formatDateCO(value, { includeTime: true });
};

/**
 * Returns the current date in local YYYY-MM-DD format in Colombia.
 */
export const toLocalISODate = (value: Date = new Date()): string => {
  // Offset Bogotá is UTC-5
  const offset = -5;
  const utc = value.getTime() + value.getTimezoneOffset() * 60000;
  const bogotaDate = new Date(utc + 3600000 * offset);
  
  const yyyy = bogotaDate.getFullYear();
  const mm = String(bogotaDate.getMonth() + 1).padStart(2, "0");
  const dd = String(bogotaDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
