import { useEffect, useRef, useState } from "react";
import { Photo, savePhoto, getPhotosForTrip, deletePhoto, photoToBlob } from "@/lib/photoStorage";
import { Camera, Trash2, Loader2 } from "lucide-react";

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
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      await savePhoto(photoKey, file);
    }
    await refresh();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    await deletePhoto(id);
    await refresh();
  };

  return (
    <div style={{ background:"#0a1628", border:"0.5px solid #1a2d4a", borderRadius:8, padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <label style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:"1.5px", textTransform:"uppercase" }}>
          Foto{label ? ` — ${label}` : ""} <span style={{ opacity:0.4, fontSize:9, textTransform:"none" }}>(opzionale)</span>
        </label>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"5px 10px",
            borderRadius:999, background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.3)",
            color:"#60a5fa", cursor: uploading ? "default" : "pointer" }}>
          {uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Camera className="w-3 h-3"/>}
          Aggiungi foto
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:"none" }}
          onChange={e => handleFiles(e.target.files)}/>
      </div>

      {!loading && photos.length === 0 && (
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>Nessuna foto ancora.</p>
      )}

      {photos.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(84px, 1fr))", gap:8 }}>
          {photos.map(p => (
            <div key={p.id} style={{ position:"relative", aspectRatio:"1", borderRadius:8, overflow:"hidden", background:"#060e1e" }}>
              <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
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
    </div>
  );
}
