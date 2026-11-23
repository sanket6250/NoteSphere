package com.notesphere.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AuthControllerTest {
  private final AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
  private final SecurityContextRepository contextRepository = mock(SecurityContextRepository.class);
  private final AuthController controller = new AuthController(
    authenticationManager,
    contextRepository,
    "notesphere123"
  );

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void superPasswordCreatesSessionForSubmittedUsername() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getSession(true)).thenReturn(mock(jakarta.servlet.http.HttpSession.class));

    Map<String, String> result = controller.login(
      new AuthController.LoginRequest("sanket", "notesphere123"),
      request,
      response
    );

    assertEquals("sanket", result.get("username"));
    assertEquals("sanket", SecurityContextHolder.getContext().getAuthentication().getName());
    verifyNoInteractions(authenticationManager);
  }

  @Test
  void normalPasswordStillUsesConfiguredAuthentication() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getSession(true)).thenReturn(mock(jakarta.servlet.http.HttpSession.class));
    Authentication configuredAuthentication = UsernamePasswordAuthenticationToken.authenticated(
      "admin",
      null,
      AuthorityUtils.createAuthorityList("ROLE_USER")
    );
    when(authenticationManager.authenticate(
      org.mockito.ArgumentMatchers.any(UsernamePasswordAuthenticationToken.class)
    )).thenReturn(configuredAuthentication);

    Map<String, String> result = controller.login(
      new AuthController.LoginRequest("admin", "admin123"),
      request,
      response
    );

    assertEquals("admin", result.get("username"));
    verify(authenticationManager).authenticate(
      org.mockito.ArgumentMatchers.any(UsernamePasswordAuthenticationToken.class)
    );
  }
}
