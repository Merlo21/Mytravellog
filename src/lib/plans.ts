import { Trip, parseLocalDate, todayLocalISO } from "@/lib/storage";

/** Valuta dei budget (fissa in v1, nessun selettore). */
export const CUR = "€";

export interface PlanCountdown {
  text: string;
  /** Partenza vicina (≤14 giorni): la card la evidenzia in ambra. */
  urgent: boolean;
  /** Date già passate: il viaggio è concluso ma non ancora "segnato come fatto". */
  returned: boolean;
}

/**
 * Stato temporale di un viaggio in programma rispetto a oggi:
 * "tra N giorni" / "domani" / "oggi" / "in corso" (tra partenza e ritorno) /
 * "sei tornato?" (ritorno già passato → invito a segnarlo come fatto).
 * `todayISO` è iniettabile per i test.
 */
export function planCountdown(trip: Trip, todayISO: string = todayLocalISO()): PlanCountdown {
  const today = parseLocalDate(todayISO).getTime();
  const start = parseLocalDate(trip.trip_date).getTime();
  const end = parseLocalDate(trip.date_end || trip.trip_date).getTime();
  const days = Math.round((start - today) / 86400000);
  if (days > 1) return { text: `tra ${days} giorni`, urgent: days <= 14, returned: false };
  if (days === 1) return { text: "domani", urgent: true, returned: false };
  if (days === 0) return { text: "oggi", urgent: true, returned: false };
  if (today <= end) return { text: "in corso", urgent: false, returned: false };
  return { text: "sei tornato?", urgent: false, returned: true };
}
