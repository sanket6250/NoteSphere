package com.notesphere.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecurityConfigTest {
  private final SecurityConfig config = new SecurityConfig();

  @Test
  void configuredPlaintextPasswordIsHashedInMemoryAndAuthenticatesOnlyConfiguredUser() {
    PasswordEncoder encoder = config.passwordEncoder();
    UserDetailsService users = config.userDetailsService("single-user", "secure-password-123", encoder);
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(users);
    provider.setPasswordEncoder(encoder);
    ProviderManager manager = new ProviderManager(provider);

    assertEquals(
      "single-user",
      manager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(
        "single-user",
        "secure-password-123"
      )).getName()
    );
    assertThrows(AuthenticationException.class, () -> manager.authenticate(
      UsernamePasswordAuthenticationToken.unauthenticated("other-user", "secure-password-123")
    ));
    assertThrows(AuthenticationException.class, () -> manager.authenticate(
      UsernamePasswordAuthenticationToken.unauthenticated("single-user", "wrong-password-123")
    ));
    assertTrue(encoder.matches(
      "secure-password-123",
      users.loadUserByUsername("single-user").getPassword()
    ));
  }

  @Test
  void missingOrWeakAuthenticationEnvironmentConfigurationFailsStartup() {
    PasswordEncoder encoder = config.passwordEncoder();

    IllegalStateException missingUsername = assertThrows(
      IllegalStateException.class,
      () -> config.userDetailsService("", "secure-password-123", encoder)
    );
    IllegalStateException missingPassword = assertThrows(
      IllegalStateException.class,
      () -> config.userDetailsService("single-user", "", encoder)
    );
    IllegalStateException weakPassword = assertThrows(
      IllegalStateException.class,
      () -> config.userDetailsService("single-user", "too-short", encoder)
    );

    assertTrue(missingUsername.getMessage().contains("APP_AUTH_USERNAME"));
    assertTrue(missingPassword.getMessage().contains("APP_AUTH_PASSWORD"));
    assertTrue(weakPassword.getMessage().contains("APP_AUTH_PASSWORD"));
  }
}
