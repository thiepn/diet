package dev.thiepn.diet

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Worker
import androidx.work.WorkerParameters

class ReminderWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {
    override fun doWork(): Result {
        if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        ensureChannel()
        val type = inputData.getString("type") ?: return Result.success()
        val (title, text, id) = when (type) {
            "weigh_in" -> Triple("Diet Copilot", "Time for today's weigh-in.", 7101)
            "weekly_review" -> Triple("Diet Copilot", "Your weekly Diet Copilot review is ready.", 7102)
            else -> return Result.success()
        }
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL)
            .setSmallIcon(applicationContext.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(applicationContext).notify(id, notification)
        return Result.success()
    }

    private fun ensureChannel() {
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Diet reminders", NotificationManager.IMPORTANCE_DEFAULT))
        }
    }

    companion object { private const val CHANNEL = "diet-reminders" }
}
