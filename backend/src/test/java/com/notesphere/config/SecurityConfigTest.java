package com.notesphere.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecurityConfigTest {
  private final SecurityConfig config = new SecurityConfig();

  @Test
  void passwordEncoderStoresBcryptHashesAndVerifiesPasswords() {
    PasswordEncoder encoder = config.passwordEncoder();
    String hash = encoder.encode("a-very-long-password");

    assertTrue(hash.startsWith("$2"));
    assertTrue(encoder.matches("a-very-long-password", hash));
    assertFalse(encoder.matches("a-different-password", hash));
  }
}
