import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // The function is deployed with verify_jwt=true; the gateway validates the JWT.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const part = jwt.split(".")[1];
  if (!part) return new Response("Unauthorized", { status: 401 });
  const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  const userId = payload.sub;
  if (typeof userId !== "string") return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.activity_date || ""))) {
    return new Response("Invalid", { status: 400 });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response("Unavailable", { status: 503 });
  const sql = postgres(dbUrl, { prepare: false, max: 1 });

  try {
    await sql`
      insert into public.activity_daily (
        user_id, activity_date, steps, active_calories, exercise_minutes,
        distance_km, source, provider_payload, synced_at, updated_at
      ) values (
        ${userId}::uuid,
        ${body.activity_date}::date,
        ${Number(body.steps || 0)},
        ${Number(body.active_calories || 0)},
        ${Number(body.exercise_minutes || 0)},
        ${Number(body.distance_km || 0)},
        'health_connect',
        '{}'::jsonb,
        now(),
        now()
      )
      on conflict (user_id, activity_date) do update set
        steps = excluded.steps,
        active_calories = excluded.active_calories,
        exercise_minutes = excluded.exercise_minutes,
        distance_km = excluded.distance_km,
        source = 'health_connect',
        synced_at = now(),
        updated_at = now()
    `;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } finally {
    await sql.end({ timeout: 2 });
  }
});
