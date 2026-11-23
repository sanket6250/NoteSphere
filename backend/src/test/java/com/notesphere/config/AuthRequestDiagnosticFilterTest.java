package com.notesphere.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthRequestDiagnosticFilterTest {
  private final AuthRequestDiagnosticFilter filter = new AuthRequestDiagnosticFilter();

  @Test
  void capturesRegistrationAndLoginPathsIncludingDuplicatedApiPrefix() {
    assertFalse(shouldSkip("POST", "/api/auth/register"));
    assertFalse(shouldSkip("POST", "/api/api/auth/register"));
    assertFalse(shouldSkip("POST", "/api/auth/login"));
  }

  @Test
  void doesNotLogOtherApplicationPaths() {
    assertTrue(shouldSkip("GET", "/api/notes"));
  }

  private boolean shouldSkip(String method, String path) {
    MockHttpServletRequest request = new MockHttpServletRequest(method, path);
    request.setServletPath(path);
    return filter.shouldNotFilter(request);
  }
}
