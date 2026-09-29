drop policy if exists diet_p15_recovery_snapshots_deny on private.diet_recovery_snapshots;
create policy diet_p15_recovery_snapshots_deny
on private.diet_recovery_snapshots
as restrictive
for all
to public
using (false)
with check (false);
