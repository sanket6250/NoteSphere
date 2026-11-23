package com.notesphere.auth;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAccountServiceTest {
  private final UserAccountRepository users = mock(UserAccountRepository.class);
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
  private final UserAccountService service = new UserAccountService(users, encoder);

  @Test
  void registrationNormalizesCredentialsAndPersistsOnlyBcryptHash() {
    when(users.existsByAccountSlot((short) 1)).thenReturn(false);
    when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

    String username = service.register("  NoteUser ", " Person@Example.com ", "a-very-long-password");

    var captor = org.mockito.ArgumentCaptor.forClass(UserAccount.class);
    verify(users).saveAndFlush(captor.capture());
    UserAccount saved = captor.getValue();
    assertEquals("noteuser", username);
    assertEquals("noteuser", saved.getUsername());
    assertEquals("person@example.com", saved.getEmail());
    assertTrue(saved.getPassword().startsWith("$2"));
    assertTrue(encoder.matches("a-very-long-password", saved.getPassword()));
    assertFalse(saved.getPassword().contains("a-very-long-password"));
  }

  @Test
  void existingAccountPermanentlyClosesRegistration() {
    when(users.existsByAccountSlot((short) 1)).thenReturn(true);

    assertFalse(service.isRegistrationAvailable());
    assertThrows(
      UserAccountService.RegistrationClosedException.class,
      () -> service.register("another", "another@example.com", "a-very-long-password")
    );
    verify(users, never()).saveAndFlush(any(UserAccount.class));
  }

  @Test
  void databaseSingleAccountConstraintClosesConcurrentRegistrationRace() {
    when(users.existsByAccountSlot((short) 1)).thenReturn(false);
    when(users.saveAndFlush(any(UserAccount.class)))
      .thenThrow(new DataIntegrityViolationException("duplicate account slot"));

    assertThrows(
      UserAccountService.RegistrationClosedException.class,
      () -> service.register("one", "one@example.com", "a-very-long-password")
    );
  }

  @Test
  void rejectsBcryptInputsBeyondItsSafeByteLimit() {
    when(users.existsByAccountSlot((short) 1)).thenReturn(false);

    assertThrows(
      UserAccountService.InvalidRegistrationException.class,
      () -> service.register("noteuser", "person@example.com", "a".repeat(73))
    );
    verify(users, never()).saveAndFlush(any(UserAccount.class));
  }

  @Test
  void loginLookupNormalizesAndAcceptsUsernameOrEmail() {
    UserAccount account = new UserAccount("noteuser", "person@example.com", encoder.encode("a-very-long-password"));
    when(users.findByIdentifier("noteuser")).thenReturn(Optional.of(account));
    when(users.findByIdentifier("person@example.com")).thenReturn(Optional.of(account));

    assertSame(account, service.loadUserByUsername(" NoteUser "));
    assertSame(account, service.loadUserByUsername("PERSON@EXAMPLE.COM"));
    verify(users).findByIdentifier("noteuser");
    verify(users).findByIdentifier("person@example.com");
  }
}
