/**
 * Firma "By 🐻" a FINE PAGINA (non fissa): scorre col contenuto e compare in
 * fondo, come la firma sul retro di una stampa — non copre mai le card.
 *
 * Montata globale in main.tsx DOPO <Routes>, quindi in flusso normale finisce
 * in coda al documento su ogni pagina scrollabile. Sulle viste a schermo intero
 * (editor quadro, poster/flyover) resta sotto e non si vede: lì la firma arriva
 * comunque dall'export. Il logo è servito da public/ via BASE_URL (funziona
 * anche sotto /Mytravellog/ su Pages).
 */
export function BrandBadge() {
  return (
    <div
      aria-hidden
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "18px 0 24px", opacity: 0.5,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.03em" }}>By</span>
      <img
        src={`${import.meta.env.BASE_URL}logo-orsi.png`}
        alt=""
        width={30}
        height={30}
        style={{ display: "block" }}
      />
    </div>
  );
}
