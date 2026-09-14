package dev.thiepn.diet

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.time.DayOfWeek
import java.time.Duration
import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

object ReminderScheduler {
    private const val WEIGH_NAME = "diet-weigh-in-reminder"
    private const val WEEKLY_NAME = "diet-weekly-review-reminder"

    fun configure(
        context: Context,
        weighEnabled: Boolean,
        weighTime: String?,
        weeklyEnabled: Boolean,
        weeklyDay: Int?,
        weeklyTime: String?,
        timezone: String?,
    ) {
        val wm = WorkManager.getInstance(context)
        val zone = try { ZoneId.of(timezone ?: ZoneId.systemDefault().id) } catch (_: Exception) { ZoneId.systemDefault() }

        if (weighEnabled && !weighTime.isNullOrBlank()) {
            val target = nextDaily(weighTime, zone)
            val request = PeriodicWorkRequestBuilder<ReminderWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(Duration.between(ZonedDateTime.now(zone), target))
                .setInputData(workDataOf("type" to "weigh_in"))
                .build()
            wm.enqueueUniquePeriodicWork(WEIGH_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        } else wm.cancelUniqueWork(WEIGH_NAME)

        if (weeklyEnabled && weeklyDay != null && !weeklyTime.isNullOrBlank()) {
            val target = nextWeekly(weeklyDay, weeklyTime, zone)
            val request = PeriodicWorkRequestBuilder<ReminderWorker>(7, TimeUnit.DAYS)
                .setInitialDelay(Duration.between(ZonedDateTime.now(zone), target))
                .setInputData(workDataOf("type" to "weekly_review"))
                .build()
            wm.enqueueUniquePeriodicWork(WEEKLY_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        } else wm.cancelUniqueWork(WEEKLY_NAME)
    }

    fun cancelAll(context: Context) {
        val wm = WorkManager.getInstance(context)
        wm.cancelUniqueWork(WEIGH_NAME)
        wm.cancelUniqueWork(WEEKLY_NAME)
    }

    private fun parseTime(value: String): LocalTime = runCatching { LocalTime.parse(value.take(8)) }.getOrDefault(LocalTime.of(8, 0))

    private fun nextDaily(value: String, zone: ZoneId): ZonedDateTime {
        val now = ZonedDateTime.now(zone)
        var target = now.toLocalDate().atTime(parseTime(value)).atZone(zone)
        if (!target.isAfter(now)) target = target.plusDays(1)
        return target
    }

    private fun nextWeekly(day: Int, value: String, zone: ZoneId): ZonedDateTime {
        val now = ZonedDateTime.now(zone)
        val desired = when (day.coerceIn(0, 6)) {
            0 -> DayOfWeek.SUNDAY
            1 -> DayOfWeek.MONDAY
            2 -> DayOfWeek.TUESDAY
            3 -> DayOfWeek.WEDNESDAY
            4 -> DayOfWeek.THURSDAY
            5 -> DayOfWeek.FRIDAY
            else -> DayOfWeek.SATURDAY
        }
        var target = now.toLocalDate().atTime(parseTime(value)).atZone(zone)
        val delta = (desired.value - target.dayOfWeek.value + 7) % 7
        target = target.plusDays(delta.toLong())
        if (!target.isAfter(now)) target = target.plusWeeks(1)
        return target
    }
}
