-- Rimuove la vecchia tabella trips: non è mai stata usata dall'app (il
-- client Supabase è rimasto scollegato finché non abbiamo aggiunto il login
-- in questa sessione) e il suo schema risale a una versione molto più
-- semplice del modello dati attuale — mancano waypoints, rating,
-- transport_mode e la maggior parte dei campi aggiunti da allora.
DROP TABLE IF EXISTS public.trips;

-- Backup manuale (non sincronizzazione in tempo reale, per scelta): una
-- riga per utente con l'intero elenco dei viaggi in JSON. Evita di dover
-- ridisegnare uno schema relazionale ogni volta che la forma di Trip cambia
-- — è già successo molte volte nel corso di questo progetto.
CREATE TABLE public.backups (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trips_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own backup"
  ON public.backups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backup"
  ON public.backups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backup"
  ON public.backups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backup"
  ON public.backups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- public.set_updated_at() esiste già dalla migrazione precedente
-- (20260427143802_...sql) — non è legata alla tabella trips, resta valida.
CREATE TRIGGER backups_set_updated_at
BEFORE UPDATE ON public.backups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bucket per le foto di backup. Path: {user_id}/{tripId}/{photoId} — le
-- policy sotto usano il primo segmento del path per verificare che ogni
-- utente possa toccare solo i propri file.
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view their own trip photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own trip photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own trip photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own trip photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
