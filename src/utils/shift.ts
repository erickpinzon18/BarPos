// src/utils/shift.ts
// Horario del turno: abre a las 11:00 AM y cierra a las 2:00 AM del día siguiente.
// Un turno se identifica por la fecha del día en que abre.

export const SHIFT_START_HOUR = 11;
export const SHIFT_END_HOUR = 2;
export const SHIFT_START_LABEL = '11:00 AM';
export const SHIFT_END_LABEL = '2:00 AM';

const pad = (n: number) => String(n).padStart(2, '0');
export const SHIFT_START_HHMM = `${pad(SHIFT_START_HOUR)}:00`;
export const SHIFT_END_HHMM = `${pad(SHIFT_END_HOUR)}:00`;

/** Rango [inicio, fin] del turno que abre en la fecha dada. */
export const getShiftRange = (date: Date): { shiftStart: Date; shiftEnd: Date } => {
  const shiftStart = new Date(date);
  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  const shiftEnd = new Date(date);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(SHIFT_END_HOUR, 0, 0, 0);
  return { shiftStart, shiftEnd };
};

/**
 * Fecha (día de apertura) del turno al que pertenece un momento dado.
 * Antes de la hora de apertura cuenta como el turno de la noche anterior.
 */
export const getShiftDateFor = (d: Date): Date => {
  if (d.getHours() < SHIFT_START_HOUR) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return prev;
  }
  return new Date(d);
};

/** Fecha del turno actual (o del último, si aún no abre el de hoy). */
export const getCurrentShiftDate = (): Date => getShiftDateFor(new Date());
