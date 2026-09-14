package dev.thiepn.diet

import java.time.LocalDate

data class DailyActivity(
    val date: LocalDate,
    val steps: Long,
    val activeCalories: Double,
    val exerciseMinutes: Double,
    val distanceKm: Double,
)
