-- P16: make the read-RPC execution model explicit in migration history.
alter function public.diet_app_read_snapshot() security invoker;
