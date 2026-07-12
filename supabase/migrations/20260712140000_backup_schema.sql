-- Rimuove la vecchia tabella trips: non è mai stata usata dall'app (il
-- client Supabase è rimasto scollegato finché non abbiamo aggiunto il login
-- in questa sessione) e il suo schema risale a una versione molto più
-- semplice del modello dati attuale — mancano waypoints, rating,
-- transport_mode e la maggior parte dei campi aggiunti da allora.
DROP TABLE IF EXISTS public.trips;

-- Funzione di supporto per aggiornare updated_at automaticamente. Definita
-- qui (invece di presupporre che esista già da una migrazione precedente):
-- sul progetto live nessuna migrazione risultava mai stata applicata prima
-- d'ora, quindi anche questa andava creata da zero. CREATE OR REPLACE la
-- rende comunque sicura da rieseguire.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Backup manuale (non sincronizzazione in tempo reale, per scelta): una
-- riga per utente con l'intero elenco dei viaggi in JSON. Evita di dover
-- ridisegnare uno schema relazionale ogni volta che la forma di Trip cambia
-- — è già successo molte volte nel corso di questo progetto.
CREATE TABLE IF NOT EXISTS public.backups (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trips_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own backup" ON public.backups;
CREATE POLICY "Users can view their own backup"
  ON public.backups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own backup" ON public.backups;
CREATE POLICY "Users can insert their own backup"
  ON public.backups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own backup" ON public.backups;
CREATE POLICY "Users can update their own backup"
  ON public.backups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own backup" ON public.backups;
CREATE POLICY "Users can delete their own backup"
  ON public.backups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS backups_set_updated_at ON public.backups;
CREATE TRIGGER backups_set_updated_at
BEFORE UPDATE ON public.backups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bucket per le foto di backup. Path: {user_id}/{tripId}/{photoId} — le
-- policy sotto usano il primo segmento del path per verificare che ogni
-- utente possa toccare solo i propri file.
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view their own trip photos" ON storage.objects;
CREATE POLICY "Users can view their own trip photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload their own trip photos" ON storage.objects;
CREATE POLICY "Users can upload their own trip photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own trip photos" ON storage.objects;
CREATE POLICY "Users can update their own trip photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own trip photos" ON storage.objects;
CREATE POLICY "Users can delete their own trip photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
