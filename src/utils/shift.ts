// src/utils/shift.ts
// Día de operación para inventario: de 5 AM a 5 AM del día siguiente.
// Cubre el turno nocturno (que cruza la medianoche) sin dejar fuera cuentas abiertas
// en horarios poco comunes.

const DAY_START_HOUR = 5;

/** Fecha (a medianoche local) del día de operación al que pertenece un instante */
export const businessDayOf = (d: Date): Date => {
  const day = new Date(d);
  if (day.getHours() < DAY_START_HOUR) day.setDate(day.getDate() - 1);
  day.setHours(0, 0, 0, 0);
  return day;
};

/** Rango [inicio, fin) del día de operación */
export const getBusinessDayRange = (day: Date): { start: Date; end: Date } => {
  const start = new Date(day);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

/** Clave "YYYY-MM-DD" del día de operación */
export const businessDayKey = (d: Date): string => {
  const day = businessDayOf(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
};

/** Parsea "YYYY-MM-DD" (input type=date) como fecha local */
export const parseDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
