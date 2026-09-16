-- Diet Copilot Web 1.0.1 / Android 7.0.2 finalization
-- Canonical project: hycegznamzjhwinegaai
-- Idempotent release-hardening changes applied to production on 2026-09-15.

DROP POLICY IF EXISTS diet_native_devices_owner_select ON public.diet_native_devices;
CREATE POLICY diet_native_devices_owner_select
ON public.diet_native_devices
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_food_portions_saved_food_id
ON public.saved_food_portions (saved_food_id);
