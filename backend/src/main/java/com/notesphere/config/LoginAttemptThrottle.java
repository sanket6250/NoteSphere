package com.notesphere.config;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@Component
public final class LoginAttemptThrottle {
  private static final int MAX_FAILED_ATTEMPTS = 5;
  private static final int MAX_TRACKED_CLIENTS = 10_000;
  private static final Duration FAILURE_WINDOW = Duration.ofMinutes(10);
  private static final Duration BLOCK_DURATION = Duration.ofMinutes(15);

  private final Clock clock;
  private final Map<String, AttemptState> attempts = new HashMap<>();

  public LoginAttemptThrottle() {
    this(Clock.systemUTC());
  }

  LoginAttemptThrottle(Clock clock) {
    this.clock = clock;
  }

  public synchronized boolean isBlocked(String clientAddress) {
    Instant now = clock.instant();
    String key = clientKey(clientAddress);
    AttemptState state = attempts.get(key);
    if (state != null && state.expiredAt(now)) {
      attempts.remove(key);
      state = null;
    }

    if (state != null && state.blockedUntil() != null && now.isBefore(state.blockedUntil())) {
      return true;
    }

    if (state == null && attempts.size() >= MAX_TRACKED_CLIENTS) {
      removeExpired(now);
      return attempts.size() >= MAX_TRACKED_CLIENTS;
    }
    return false;
  }

  public synchronized void recordFailure(String clientAddress) {
    Instant now = clock.instant();
    String key = clientKey(clientAddress);
    AttemptState previous = attempts.get(key);
    if (previous == null || previous.expiredAt(now)) {
      previous = new AttemptState(now, 0, null);
    }

    int failures = previous.failures() + 1;
    Instant blockedUntil = failures >= MAX_FAILED_ATTEMPTS ? now.plus(BLOCK_DURATION) : null;
    if (!attempts.containsKey(key) && attempts.size() >= MAX_TRACKED_CLIENTS) {
      removeExpired(now);
      if (attempts.size() >= MAX_TRACKED_CLIENTS) return;
    }
    attempts.put(key, new AttemptState(previous.windowStartedAt(), failures, blockedUntil));
  }

  public synchronized void recordSuccess(String clientAddress) {
    attempts.remove(clientKey(clientAddress));
  }

  private void removeExpired(Instant now) {
    Iterator<Map.Entry<String, AttemptState>> iterator = attempts.entrySet().iterator();
    while (iterator.hasNext()) {
      if (iterator.next().getValue().expiredAt(now)) iterator.remove();
    }
  }

  private static String clientKey(String clientAddress) {
    return clientAddress == null || clientAddress.isBlank() ? "unknown" : clientAddress;
  }

  private record AttemptState(Instant windowStartedAt, int failures, Instant blockedUntil) {
    boolean expiredAt(Instant now) {
      Instant expiresAt = blockedUntil == null
        ? windowStartedAt.plus(FAILURE_WINDOW)
        : blockedUntil;
      return !now.isBefore(expiresAt);
    }
  }
}
