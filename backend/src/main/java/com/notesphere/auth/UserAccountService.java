package com.notesphere.auth;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
public class UserAccountService implements UserDetailsService {
  private static final short SINGLE_ACCOUNT_SLOT = 1;
  private static final int MAX_BCRYPT_PASSWORD_BYTES = 72;

  private final UserAccountRepository users;
  private final PasswordEncoder passwordEncoder;

  public UserAccountService(UserAccountRepository users, PasswordEncoder passwordEncoder) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional(readOnly = true)
  public boolean isRegistrationAvailable() {
    return !users.existsByAccountSlot(SINGLE_ACCOUNT_SLOT);
  }

  @Transactional
  public String register(String username, String email, String password) {
    if (!isRegistrationAvailable()) throw new RegistrationClosedException();
    if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BCRYPT_PASSWORD_BYTES) {
      throw new InvalidRegistrationException("Password must be no more than 72 UTF-8 bytes.");
    }

    String normalizedUsername = username.trim().toLowerCase(Locale.ROOT);
    String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
    UserAccount account = new UserAccount(
      normalizedUsername,
      normalizedEmail,
      passwordEncoder.encode(password)
    );

    try {
      users.saveAndFlush(account);
    } catch (DataIntegrityViolationException exception) {
      throw new RegistrationClosedException();
    }
    return normalizedUsername;
  }

  @Override
  @Transactional(readOnly = true)
  public UserAccount loadUserByUsername(String identifier) throws UsernameNotFoundException {
    String normalizedIdentifier = identifier.trim().toLowerCase(Locale.ROOT);
    return users.findByIdentifier(normalizedIdentifier)
      .orElseThrow(() -> new UsernameNotFoundException("Invalid username or password."));
  }

  public static final class RegistrationClosedException extends RuntimeException {
    public RegistrationClosedException() {
      super("An account already exists; registration is closed.");
    }
  }

  public static final class InvalidRegistrationException extends RuntimeException {
    public InvalidRegistrationException(String message) {
      super(message);
    }
  }
}
