import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Applica fn a ogni elemento in sequenza, con una pausa tra una chiamata e la
 * successiva — invece di un Promise.all che le spara tutte in parallelo. Va
 * usato per le API con un rate limit basato sul tempo (es. Nominatim, che
 * nella sua usage policy chiede di non superare 1 richiesta/secondo): un
 * viaggio con molte tappe rischierebbe altrimenti un rate-limit silenzioso,
 * con alcune tappe che restano senza regione senza che l'utente se ne accorga.
 */
export async function sequentialMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  delayMs = 1100
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    out.push(await fn(items[i], i));
  }
  return out;
}
