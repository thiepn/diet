package dev.thiepn.diet

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class NativeSession(
    val supabaseUrl: String,
    val anonKey: String,
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
)

class SecureSessionStore(private val context: Context) {
    private val prefs = context.getSharedPreferences("diet_native_secure", Context.MODE_PRIVATE)
    private val devicePrefs = context.getSharedPreferences("diet_native_device", Context.MODE_PRIVATE)
    private val alias = "diet_copilot_session_v1"

    fun deviceId(): String {
        val current = devicePrefs.getString("device_id", null)
        if (!current.isNullOrBlank()) return current
        val created = UUID.randomUUID().toString()
        devicePrefs.edit().putString("device_id", created).apply()
        return created
    }

    fun save(session: NativeSession) {
        val payload = JSONObject()
            .put("url", session.supabaseUrl)
            .put("anon", session.anonKey)
            .put("access", session.accessToken)
            .put("refresh", session.refreshToken)
            .put("expires", session.expiresAt)
            .toString()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val ciphertext = cipher.doFinal(payload.toByteArray(Charsets.UTF_8))
        val encoded = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ciphertext, Base64.NO_WRAP)
        prefs.edit().putString("session", encoded).apply()
    }

    fun load(): NativeSession? {
        val encoded = prefs.getString("session", null) ?: return null
        return try {
            val parts = encoded.split(":", limit = 2)
            if (parts.size != 2) return null
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            val json = JSONObject(String(cipher.doFinal(ciphertext), Charsets.UTF_8))
            NativeSession(
                json.getString("url"),
                json.getString("anon"),
                json.getString("access"),
                json.getString("refresh"),
                json.optLong("expires", 0L),
            )
        } catch (_: Exception) {
            null
        }
    }

    fun clear() = prefs.edit().remove("session").apply()

    fun setLastSync(epochMillis: Long) = devicePrefs.edit().putLong("last_sync", epochMillis).apply()
    fun lastSync(): Long = devicePrefs.getLong("last_sync", 0L)

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build()
        )
        return generator.generateKey()
    }
}
