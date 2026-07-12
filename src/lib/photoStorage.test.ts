import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";
import { savePhoto, getPhotosForTrip, deletePhoto, deletePhotosForTrip, photoToBlob, __resetPhotoDB } from "./photoStorage";

function makeBlob(content = "fake-image-bytes"): Blob {
  return new Blob([content], { type: "image/jpeg" });
}

describe("photoStorage", () => {
  beforeEach(async () => {
    // fake-indexeddb non condivide stato tra file di test, ma tra i singoli
    // test di questo stesso file sì: puliamo il DB per isolarli.
    indexedDB = new IDBFactory();
    __resetPhotoDB();
  });

  it("salva una foto e la ritrova tra quelle del viaggio", async () => {
    const id = await savePhoto("trip-1", makeBlob());
    const photos = await getPhotosForTrip("trip-1");
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe(id);
    expect(photos[0].tripId).toBe("trip-1");
  });

  it("il blob ricostruito ha lo stesso contenuto e tipo dell'originale", async () => {
    const blob = makeBlob("contenuto specifico");
    await savePhoto("trip-1", blob);
    const [photo] = await getPhotosForTrip("trip-1");
    const rebuilt = photoToBlob(photo);
    expect(rebuilt.size).toBe(blob.size);
    expect(rebuilt.type).toBe("image/jpeg");
    expect(new TextDecoder().decode(photo.data)).toBe("contenuto specifico");
  });

  it("non mescola le foto di viaggi diversi", async () => {
    await savePhoto("trip-1", makeBlob());
    await savePhoto("trip-2", makeBlob());
    await savePhoto("trip-2", makeBlob());
    expect(await getPhotosForTrip("trip-1")).toHaveLength(1);
    expect(await getPhotosForTrip("trip-2")).toHaveLength(2);
  });

  it("nessuna foto per un viaggio senza foto salvate", async () => {
    expect(await getPhotosForTrip("trip-senza-foto")).toEqual([]);
  });

  it("deletePhoto rimuove solo la foto indicata", async () => {
    const id1 = await savePhoto("trip-1", makeBlob());
    const id2 = await savePhoto("trip-1", makeBlob());
    await deletePhoto(id1);
    const remaining = await getPhotosForTrip("trip-1");
    expect(remaining.map(p => p.id)).toEqual([id2]);
  });

  it("deletePhotosForTrip rimuove tutte le foto di un viaggio senza toccare le altre", async () => {
    await savePhoto("trip-1", makeBlob());
    await savePhoto("trip-1", makeBlob());
    await savePhoto("trip-2", makeBlob());
    await deletePhotosForTrip("trip-1");
    expect(await getPhotosForTrip("trip-1")).toEqual([]);
    expect(await getPhotosForTrip("trip-2")).toHaveLength(1);
  });

  it("assegna id univoci a foto diverse", async () => {
    const id1 = await savePhoto("trip-1", makeBlob());
    const id2 = await savePhoto("trip-1", makeBlob());
    expect(id1).not.toBe(id2);
  });
});
