/**
 * Firma "By 🐻" fissa in basso a destra, su OGNI pagina dell'app.
 *
 * - `pointer-events: none` → non intercetta mai i click, non dà mai fastidio;
 * - z-index moderato → sta SOTTO ai modali a schermo intero (poster/flyover):
 *   su quelli la firma arriva dall'export SVG, non da qui;
 * - il logo è servito da `public/logo-orsi.png` (orsi bianchi, sfondo
 *   trasparente) via BASE_URL, così funziona anche sotto /Mytravellog/ su Pages.
 */
export function BrandBadge() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed", right: 10, bottom: 10, zIndex: 40, pointerEvents: "none",
        display: "flex", alignItems: "center", gap: 6, opacity: 0.55,
        padding: "4px 9px", borderRadius: 999,
        background: "rgba(6,14,30,0.55)", border: "0.5px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>By</span>
      <img
        src={`${import.meta.env.BASE_URL}logo-orsi.png`}
        alt=""
        width={18}
        height={18}
        style={{ display: "block" }}
      />
    </div>
  );
}
