package dev.thiepn.diet

import android.app.Activity
import android.os.Bundle
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.feature.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission

class HealthPermissionActivity : Activity() {
    private val permissionLauncher = registerForActivityResult(
        androidx.health.connect.client.PermissionController.createRequestPermissionResultContract()
    ) {
        setResult(RESULT_OK)
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val reader = HealthConnectReader(this)
        val client = reader.clientOrNull()
        if (client == null) {
            setResult(RESULT_CANCELED)
            finish()
            return
        }
        val permissions = HealthConnectReader.BASE_PERMISSIONS.toMutableSet()
        if (client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE) {
            permissions += HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
        }
        permissionLauncher.launch(permissions)
    }
}
