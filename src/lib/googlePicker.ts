// Google Picker: permette al PARTNER di selezionare il file "navta-shared-map"
// condiviso con lui. Con lo scope drive.file, aprire un file altrui col Picker
// è ciò che concede all'app l'accesso a quel file — da lì in poi push/pull
// funzionano. Chiave API pubblica (limitata per referrer + API) e project
// number sono richiesti dal Picker.
const PICKER_API_KEY = "AIzaSyAhXAHl79q-LJtpW5Jioh2jDGgtufZFrtM";
const PICKER_APP_ID = "238461152099"; // project number (inizio del Client ID)
const SHARED_FILE_NAME = "navta-shared-map.json";

let pickerReady: Promise<void> | null = null;

/** Carica lo script gapi + il modulo "picker" una sola volta. */
function loadPicker(): Promise<void> {
  if (pickerReady) return pickerReady;
  pickerReady = new Promise<void>((resolve, reject) => {
    const w = window as any;
    if (w.google?.picker) { resolve(); return; }
    const onLoad = () => w.gapi.load("picker", { callback: () => resolve() });
    const existing = document.getElementById("gapi-api-script") as HTMLScriptElement | null;
    if (existing) { if (w.gapi) onLoad(); else existing.addEventListener("load", onLoad); return; }
    const s = document.createElement("script");
    s.id = "gapi-api-script";
    s.src = "https://apis.google.com/js/api.js";
    s.async = true; s.defer = true;
    s.onload = onLoad;
    s.onerror = () => { pickerReady = null; reject(new Error("picker_load_failed")); };
    document.head.appendChild(s);
  });
  return pickerReady;
}

/**
 * Apre il Picker filtrato ai file JSON dell'utente (inclusi quelli condivisi
 * con lui). Ritorna l'id del file scelto, o null se annulla.
 */
export async function pickSharedFile(token: string): Promise<string | null> {
  await loadPicker();
  const google = (window as any).google;
  return new Promise<string | null>((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes("application/json")
      .setMode(google.picker.DocsViewMode.LIST)
      .setQuery(SHARED_FILE_NAME);
    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(PICKER_API_KEY)
      .setAppId(PICKER_APP_ID)
      .setTitle("Scegli la mappa condivisa")
      .addView(view)
      .setCallback((data: any) => {
        const action = data[google.picker.Response.ACTION];
        if (action === google.picker.Action.PICKED) {
          resolve(data[google.picker.Response.DOCUMENTS]?.[0]?.[google.picker.Document.ID] ?? null);
        } else if (action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
