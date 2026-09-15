package dev.thiepn.diet

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId

class HealthConnectReader(private val context: Context) {
    companion object {
        const val PROVIDER = "com.google.android.apps.healthdata"
        val BASE_PERMISSIONS = setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        )
    }

    fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(context, PROVIDER)

    fun clientOrNull(): HealthConnectClient? =
        if (sdkStatus() == HealthConnectClient.SDK_AVAILABLE) HealthConnectClient.getOrCreate(context) else null

    suspend fun grantedPermissions(): Set<String> = clientOrNull()?.permissionController?.getGrantedPermissions() ?: emptySet()

    suspend fun hasBasePermissions(): Boolean = grantedPermissions().containsAll(BASE_PERMISSIONS)

    suspend fun supportsBackgroundRead(): Boolean {
        val client = clientOrNull() ?: return false
        return client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    }

    suspend fun hasBackgroundRead(): Boolean =
        supportsBackgroundRead() && grantedPermissions().contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)

    suspend fun readDay(date: LocalDate, zone: ZoneId = ZoneId.systemDefault()): DailyActivity {
        val client = clientOrNull() ?: error("Health Connect unavailable")
        val start = date.atStartOfDay(zone).toInstant()
        val end = date.plusDays(1).atStartOfDay(zone).toInstant()
        val range = TimeRangeFilter.between(start, end)
        val aggregate = client.aggregate(
            AggregateRequest(
                metrics = setOf(
                    StepsRecord.COUNT_TOTAL,
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                    DistanceRecord.DISTANCE_TOTAL,
                ),
                timeRangeFilter = range,
            )
        )
        val sessions = client.readRecords(
            ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = range,
            )
        ).records
        val exerciseMinutes = sessions.sumOf { record ->
            val clippedStart = if (record.startTime.isBefore(start)) start else record.startTime
            val clippedEnd = if (record.endTime.isAfter(end)) end else record.endTime
            Duration.between(clippedStart, clippedEnd).toMillis().coerceAtLeast(0L) / 60000.0
        }
        return DailyActivity(
            date = date,
            steps = aggregate[StepsRecord.COUNT_TOTAL] ?: 0L,
            activeCalories = aggregate[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0,
            exerciseMinutes = exerciseMinutes,
            distanceKm = aggregate[DistanceRecord.DISTANCE_TOTAL]?.inKilometers ?: 0.0,
        )
    }
}
