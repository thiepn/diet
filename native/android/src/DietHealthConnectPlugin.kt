package dev.thiepn.diet

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.health.connect.client.HealthConnectClient
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate

@CapacitorPlugin(name = "DietHealthConnect")
class DietHealthConnectPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val store by lazy { SecureSessionStore(context) }
    private val reader by lazy { HealthConnectReader(context) }

    @PluginMethod
    fun getState(call: PluginCall) {
        scope.launch {
            val status = when (reader.sdkStatus()) {
                HealthConnectClient.SDK_AVAILABLE -> "available"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
                else -> "unavailable"
            }
            val baseGranted = runCatching { reader.hasBasePermissions() }.getOrDefault(false)
            val backgroundSupported = runCatching { reader.supportsBackgroundRead() }.getOrDefault(false)
            val backgroundGranted = runCatching { reader.hasBackgroundRead() }.getOrDefault(false)
            val notificationGranted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            val lastSync = store.lastSync().takeIf { it > 0 }?.let { Instant.ofEpochMilli(it).toString() }
            call.resolve(JSObject().apply {
                put("platform", "android")
                put("version", "7.0.0")
                put("healthConnectStatus", status)
                put("permissionsGranted", baseGranted)
                put("backgroundReadSupported", backgroundSupported)
                put("backgroundReadGranted", backgroundGranted)
                put("notificationPermissionGranted", notificationGranted)
                put("sessionConfigured", store.load() != null)
                put("lastSyncAt", lastSync)
                put("deviceId", store.deviceId())
            })
        }
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        if (reader.sdkStatus() != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is not available on this device")
            return
        }
        activity.runOnUiThread {
            activity.startActivity(Intent(context, HealthPermissionActivity::class.java))
            call.resolve(JSObject().put("opened", true))
        }
    }

    @PluginMethod
    fun configureSession(call: PluginCall) {
        val url = call.getString("supabaseUrl")?.trim().orEmpty()
        val anon = call.getString("anonKey").orEmpty()
        val access = call.getString("accessToken").orEmpty()
        val refresh = call.getString("refreshToken").orEmpty()
        val expires = call.getLong("expiresAt") ?: 0L
        if (!url.startsWith("https://") || anon.isBlank() || access.isBlank() || refresh.isBlank()) {
            call.reject("Incomplete native session")
            return
        }
        store.save(NativeSession(url, anon, access, refresh, expires))
        HealthSyncWorker.schedule(context)
        call.resolve(JSObject().put("configured", true))
    }

    @PluginMethod
    fun clearSession(call: PluginCall) {
        store.clear()
        HealthSyncWorker.cancel(context)
        ReminderScheduler.cancelAll(context)
        call.resolve()
    }

    @PluginMethod
    fun syncDailyActivity(call: PluginCall) {
        val days = (call.getInt("days") ?: 2).coerceIn(1, 7)
        scope.launch {
            if (!reader.hasBasePermissions()) {
                call.reject("Health Connect permission is required")
                return@launch
            }
            try {
                val client = HealthSyncClient(store)
                val payload = JSArray()
                val today = LocalDate.now()
                for (offset in (days - 1) downTo 0) {
                    val data = reader.readDay(today.minusDays(offset.toLong()))
                    client.upload(data)
                    payload.put(JSObject().apply {
                        put("activity_date", data.date.toString())
                        put("steps", data.steps)
                        put("active_calories", data.activeCalories)
                        put("exercise_minutes", data.exerciseMinutes)
                        put("distance_km", data.distanceKm)
                    })
                }
                call.resolve(JSObject().apply { put("days", payload); put("lastSyncAt", Instant.now().toString()) })
            } catch (error: Exception) {
                call.reject("Health Connect sync failed", error)
            }
        }
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        activity.runOnUiThread {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7010)
            call.resolve(JSObject().put("opened", true))
        }
    }

    @PluginMethod
    fun configureReminders(call: PluginCall) {
        ReminderScheduler.configure(
            context = context,
            weighEnabled = call.getBoolean("weighEnabled") ?: false,
            weighTime = call.getString("weighTime"),
            weeklyEnabled = call.getBoolean("weeklyEnabled") ?: false,
            weeklyDay = call.getInt("weeklyDay"),
            weeklyTime = call.getString("weeklyTime"),
            timezone = call.getString("timezone"),
        )
        call.resolve(JSObject().put("configured", true))
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }
}
