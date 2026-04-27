CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  home_latitude DOUBLE PRECISION NOT NULL,
  home_longitude DOUBLE PRECISION NOT NULL,
  home_label TEXT,
  temperature_c DOUBLE PRECISION,
  altitude_m DOUBLE PRECISION,
  distance_from_home_km DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
  ON public.trips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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

CREATE TRIGGER trips_set_updated_at
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX trips_user_id_idx ON public.trips(user_id);
CREATE INDEX trips_trip_date_idx ON public.trips(trip_date DESC);