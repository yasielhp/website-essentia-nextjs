ALTER TABLE public.races
  ALTER COLUMN date TYPE TIMESTAMPTZ USING date::timestamptz;
