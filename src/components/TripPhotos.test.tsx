import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TripPhotos } from "./TripPhotos";
import { __resetPhotoDB } from "@/lib/photoStorage";
import React from "react";

function makeImageFile(name = "foto.jpg", content = "bytes"): File {
  return new File([content], name, { type: "image/jpeg" });
}

describe("TripPhotos", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    __resetPhotoDB();
    // jsdom non implementa createObjectStore/revokeObjectURL per i Blob.
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  it("mostra 'Nessuna foto ancora' quando il viaggio non ha foto", async () => {
    render(<TripPhotos photoKey="trip-1"/>);
    expect(await screen.findByText(/nessuna foto ancora/i)).toBeInTheDocument();
  });

  it("aggiunge una foto tramite l'input file e la mostra in galleria", async () => {
    render(<TripPhotos photoKey="trip-1"/>);
    await screen.findByText(/nessuna foto ancora/i);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeImageFile()] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Elimina foto" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/nessuna foto ancora/i)).not.toBeInTheDocument();
  });

  it("ignora file non immagine selezionati insieme ad altri", async () => {
    render(<TripPhotos photoKey="trip-1"/>);
    await screen.findByText(/nessuna foto ancora/i);

    const notAnImage = new File(["testo"], "doc.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeImageFile(), notAnImage] } });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Elimina foto" })).toHaveLength(1);
    });
  });

  it("click su elimina rimuove la foto dalla galleria", async () => {
    render(<TripPhotos photoKey="trip-1"/>);
    await screen.findByText(/nessuna foto ancora/i);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeImageFile()] } });
    const deleteBtn = await screen.findByRole("button", { name: "Elimina foto" });

    fireEvent.click(deleteBtn);
    expect(await screen.findByText(/nessuna foto ancora/i)).toBeInTheDocument();
  });

  it("mostra le foto solo del viaggio indicato, non di altri", async () => {
    const { savePhoto } = await import("@/lib/photoStorage");
    await savePhoto("altro-viaggio", makeImageFile());

    render(<TripPhotos photoKey="trip-1"/>);
    expect(await screen.findByText(/nessuna foto ancora/i)).toBeInTheDocument();
  });

  it("mostra il nome della tappa nell'intestazione quando passato via label", async () => {
    render(<TripPhotos photoKey="trip-1:waypoint:wp-1" label="Torino"/>);
    expect(await screen.findByText(/Foto — Torino/)).toBeInTheDocument();
  });

  it("usa solo 'Foto' come intestazione se label non è passato", async () => {
    render(<TripPhotos photoKey="trip-1"/>);
    expect(await screen.findByText("Foto")).toBeInTheDocument();
  });
});
