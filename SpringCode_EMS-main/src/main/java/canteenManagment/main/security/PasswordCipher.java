package canteenManagment.main.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Reversible copy of a login password, so the Edit employee dialog can show an
 * administrator the password that is saved for an account.
 *
 * <p>Sign-in is untouched: {@code user.password} still holds the BCrypt hash and
 * remains the only value {@code AuthenticationManager} reads. This class writes a
 * second, AES-GCM encrypted field ({@code user.encryptedPassword}) purely for
 * review, and is the only place that decrypts it.
 *
 * <p>The key comes from {@code ems.security.password-secret}. Changing that value
 * makes every stored copy unreadable - the dialog then reports that no readable
 * copy exists, and nobody loses the ability to sign in.
 */
@Component
public class PasswordCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public PasswordCipher(
            @Value("${ems.security.password-secret:ems-local-password-review-key}") String secret) {
        this.key = new SecretKeySpec(sha256(secret), "AES");
    }

    /** AES needs a 16/24/32 byte key, so the configured secret is hashed to 32. */
    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot derive the password review key", e);
        }
    }

    /**
     * @return {@code iv:ciphertext} in Base64, or {@code null} for a blank input
     *         so an account that never had its password set stores nothing.
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            Base64.Encoder encoder = Base64.getEncoder();
            return encoder.encodeToString(iv) + ":" + encoder.encodeToString(encrypted);
        } catch (Exception e) {
            throw new IllegalStateException("Could not store the password review copy", e);
        }
    }

    /**
     * @return the readable password, or {@code null} when the value cannot be
     *         decrypted - a different key, a corrupted row, or an account whose
     *         password was set before this feature existed.
     */
    public String decrypt(String stored) {
        if (stored == null || !stored.contains(":")) {
            return null;
        }
        try {
            String[] parts = stored.split(":", 2);
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] encrypted = Base64.getDecoder().decode(parts[1]);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }
}
