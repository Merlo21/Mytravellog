import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Photo, savePhoto, getPhotosForTrip, deletePhoto, photoToBlob } from "@/lib/photoStorage";
import { Camera, ImagePlus, Trash2, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  /** Chiave di IndexedDB per questa tappa (vedi destinationPhotoKey/homePhotoKey/waypointPhotoKey in photoStorage.ts). */
  photoKey: string;
  /** Nome della tappa mostrato nell'intestazione (es. la città) — "Foto" da solo se omesso. */
  label?: string;
}

interface PhotoWithUrl extends Photo {
  url: string;
}

export function TripPhotos({ photoKey, label }: Props) {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  const refresh = async () => {
    const raw = await getPhotosForTrip(photoKey);
    // Revoca gli object URL vecchi solo dopo aver creato quelli nuovi: se lo
    // facessimo prima, un <img> ancora montato con il vecchio src lampeggerebbe.
    const oldUrls = urlsRef.current;
    const withUrls = raw
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(p => ({ ...p, url: URL.createObjectURL(photoToBlob(p)) }));
    urlsRef.current = withUrls.map(p => p.url);
    oldUrls.forEach(u => URL.revokeObjectURL(u));
    setPhotos(withUrls);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    return () => { urlsRef.current.forEach(u => URL.revokeObjectURL(u)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        await savePhoto(photoKey, file);
      }
      await refresh();
    } finally {
      // Anche se savePhoto fallisce (es. quota IndexedDB esaurita), i bottoni
      // non devono restare bloccati per sempre sullo spinner.
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await deletePhoto(id);
    await refresh();
  };

  // ── Lightbox ──────────────────────────────────────────────────────────────
  // Indice della foto aperta a schermo intero, null = chiuso. Renderizzato in
  // un portal su document.body: dentro al form un antenato con transform
  // renderebbe il position:fixed relativo alla card invece che al viewport.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const showPrev = () => setViewerIndex(i => (i === null ? null : (i - 1 + photos.length) % photos.length));
  const showNext = () => setViewerIndex(i => (i === null ? null : (i + 1) % photos.length));

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerIndex(null);
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIndex === null, photos.length]);

  // Se la foto aperta viene eliminata o la lista si accorcia, evita un indice fuori range.
  useEffect(() => {
    if (viewerIndex !== null && viewerIndex >= photos.length) {
      setViewerIndex(photos.length > 0 ? photos.length - 1 : null);
    }
  }, [photos.length, viewerIndex]);

  return (
    <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px", textTransform:"uppercase" }}>
          Foto{label ? ` — ${label}` : ""} <span style={{ opacity:0.4, fontSize:9, textTransform:"none" }}>(opzionale)</span>
        </label>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading}
            aria-label="Scatta foto" title="Scatta foto"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", width:26, height:26,
              borderRadius:999, background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.3)",
              color:"#60a5fa", cursor: uploading ? "default" : "pointer" }}>
            <Camera className="w-3 h-3"/>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"5px 10px",
              borderRadius:999, background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.3)",
              color:"#60a5fa", cursor: uploading ? "default" : "pointer" }}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImagePlus className="w-3 h-3"/>}
            Aggiungi foto
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:"none" }}
          onChange={e => handleFiles(e.target.files)}/>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
          onChange={e => handleFiles(e.target.files)}/>
      </div>

      {!loading && photos.length === 0 && (
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>Nessuna foto ancora.</p>
      )}

      {photos.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(84px, 1fr))", gap:8 }}>
          {photos.map((p, i) => (
            <div key={p.id} style={{ position:"relative", aspectRatio:"1", borderRadius:8, overflow:"hidden", background:"#060e1e" }}>
              <img src={p.url} alt="" onClick={() => setViewerIndex(i)}
                role="button" aria-label="Apri foto a schermo intero"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewerIndex(i); } }}
                style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"pointer" }}/>
              <button type="button" onClick={() => handleDelete(p.id)} aria-label="Elimina foto"
                style={{ position:"absolute", top:4, right:4, width:20, height:20, borderRadius:6,
                  background:"rgba(6,14,30,0.75)", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", color:"#f87171" }}>
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
          ))}
        </div>
      )}

      {viewerIndex !== null && photos[viewerIndex] && createPortal(
        <div
          onClick={() => setViewerIndex(null)}
          onTouchStart={e => { touchStartXRef.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const startX = touchStartXRef.current;
            touchStartXRef.current = null;
            if (startX === null || photos.length < 2) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) < 50) return; // tocco, non swipe
            if (dx > 0) showPrev(); else showNext();
          }}
          style={{
            position:"fixed", inset:0, zIndex:200, background:"rgba(2,8,18,0.94)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
          <img src={photos[viewerIndex].url} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth:"92vw", maxHeight:"86vh", objectFit:"contain", borderRadius:8 }}/>

          <button type="button" onClick={() => setViewerIndex(null)} aria-label="Chiudi foto"
            style={{ position:"absolute", top:16, right:16, width:34, height:34, borderRadius:10,
              background:"rgba(10,22,40,0.8)", border:"0.5px solid #1a2d4a", cursor:"pointer",
              color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <X className="w-4 h-4"/>
          </button>

          {photos.length > 1 && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); showPrev(); }} aria-label="Foto precedente"
                style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)",
                  width:36, height:36, borderRadius:"50%", background:"rgba(10,22,40,0.8)",
                  border:"0.5px solid #1a2d4a", cursor:"pointer", color:"rgba(255,255,255,0.7)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                <ChevronLeft className="w-4 h-4"/>
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); showNext(); }} aria-label="Foto successiva"
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                  width:36, height:36, borderRadius:"50%", background:"rgba(10,22,40,0.8)",
                  border:"0.5px solid #1a2d4a", cursor:"pointer", color:"rgba(255,255,255,0.7)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                <ChevronRight className="w-4 h-4"/>
              </button>
              <div style={{ position:"absolute", bottom:18, left:"50%", transform:"translateX(-50%)",
                fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.7)",
                background:"rgba(10,22,40,0.8)", border:"0.5px solid #1a2d4a",
                borderRadius:999, padding:"4px 12px" }}>
                {viewerIndex + 1} / {photos.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
