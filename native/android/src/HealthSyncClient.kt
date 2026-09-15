package dev.thiepn.diet

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class HealthSyncClient(private val store: SecureSessionStore) {
    private fun connection(url: String, method: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 20000
            doInput = true
        }

    private fun currentSession(): NativeSession = store.load() ?: error("Native session not configured")

    private fun ensureSession(): NativeSession {
        val session = currentSession()
        if (session.expiresAt <= 0 || session.expiresAt > System.currentTimeMillis() / 1000 + 300) return session
        return refresh(session)
    }

    private fun refresh(session: NativeSession): NativeSession {
        val conn = connection("${session.supabaseUrl.trimEnd('/')}/auth/v1/token?grant_type=refresh_token", "POST")
        conn.doOutput = true
        conn.setRequestProperty("apikey", session.anonKey)
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("refresh_token", session.refreshToken).toString().toByteArray()) }
        if (conn.responseCode !in 200..299) error("Session refresh failed")
        val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        val updated = NativeSession(
            supabaseUrl = session.supabaseUrl,
            anonKey = session.anonKey,
            accessToken = json.getString("access_token"),
            refreshToken = json.optString("refresh_token", session.refreshToken),
            expiresAt = System.currentTimeMillis() / 1000 + json.optLong("expires_in", 3600L),
        )
        store.save(updated)
        return updated
    }

    fun upload(activity: DailyActivity) {
        var session = ensureSession()
        var status = post(session, activity)
        if (status == 401) {
            session = refresh(session)
            status = post(session, activity)
        }
        if (status !in 200..299) error("Health sync failed with HTTP $status")
        store.setLastSync(System.currentTimeMillis())
    }

    private fun post(session: NativeSession, activity: DailyActivity): Int {
        val url = "${session.supabaseUrl.trimEnd('/')}/functions/v1/diet-health-sync"
        val conn = connection(url, "POST")
        conn.doOutput = true
        conn.setRequestProperty("apikey", session.anonKey)
        conn.setRequestProperty("Authorization", "Bearer ${session.accessToken}")
        conn.setRequestProperty("Content-Type", "application/json")
        val body = JSONObject()
            .put("device_id", store.deviceId())
            .put("activity_date", activity.date.toString())
            .put("steps", activity.steps)
            .put("active_calories", activity.activeCalories)
            .put("exercise_minutes", activity.exerciseMinutes)
            .put("distance_km", activity.distanceKm)
            .toString()
        conn.outputStream.use { it.write(body.toByteArray()) }
        return conn.responseCode
    }
}
