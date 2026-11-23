package com.notesphere.config;

import com.notesphere.auth.UserAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthControllerTest {
  private final AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
  private final SecurityContextRepository contextRepository = mock(SecurityContextRepository.class);
  private final UserAccountService userAccountService = mock(UserAccountService.class);
  private final LoginAttemptThrottle throttle = new LoginAttemptThrottle();
  private final AuthController controller = new AuthController(
    authenticationManager,
    contextRepository,
    throttle,
    userAccountService
  );

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void successfulDatabaseLoginCreatesAndPersistsSession() {
    HttpServletRequest request = requestFrom("192.0.2.10");
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getSession(true)).thenReturn(mock(jakarta.servlet.http.HttpSession.class));
    Authentication configuredAuthentication = UsernamePasswordAuthenticationToken.authenticated(
      "single-user",
      null,
      AuthorityUtils.createAuthorityList("ROLE_USER")
    );
    when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
      .thenReturn(configuredAuthentication);

    Map<String, String> result = controller.login(
      new AuthController.LoginRequest("single-user", "correct configured password"),
      request,
      response
    );

    assertEquals(Map.of("username", "single-user"), result);
    assertEquals("single-user", SecurityContextHolder.getContext().getAuthentication().getName());
    verify(contextRepository).saveContext(any(), org.mockito.ArgumentMatchers.eq(request),
      org.mockito.ArgumentMatchers.eq(response));
  }

  @Test
  void incorrectCredentialsReturnGenericUnauthorizedResponse() {
    HttpServletRequest request = requestFrom("192.0.2.11");
    when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
      .thenThrow(new BadCredentialsException("username not found"));

    ResponseStatusException failure = assertThrows(ResponseStatusException.class, () -> controller.login(
      new AuthController.LoginRequest("wrong-user", "wrong password value"),
      request,
      mock(HttpServletResponse.class)
    ));

    assertEquals(HttpStatus.UNAUTHORIZED, failure.getStatusCode());
    assertEquals("Invalid username or password.", failure.getReason());
  }

  @Test
  void repeatedFailuresAreThrottledForTheClient() {
    HttpServletRequest request = requestFrom("192.0.2.12");
    when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
      .thenThrow(new BadCredentialsException("invalid credentials"));

    for (int attempt = 0; attempt < 5; attempt++) {
      assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(ResponseStatusException.class, () -> controller.login(
        new AuthController.LoginRequest("single-user", "wrong password value"),
        request,
        mock(HttpServletResponse.class)
      )).getStatusCode());
    }

    ResponseStatusException blocked = assertThrows(ResponseStatusException.class, () -> controller.login(
      new AuthController.LoginRequest("single-user", "correct configured password"),
      request,
      mock(HttpServletResponse.class)
    ));

    assertEquals(HttpStatus.TOO_MANY_REQUESTS, blocked.getStatusCode());
    verify(authenticationManager, times(5)).authenticate(any(UsernamePasswordAuthenticationToken.class));
  }

  @Test
  void registrationCreatesAndAuthenticatesTheOnlyAccount() {
    HttpServletRequest request = requestFrom("192.0.2.13");
    when(request.getSession(true)).thenReturn(mock(jakarta.servlet.http.HttpSession.class));
    when(userAccountService.register("NewUser", "New@Example.com", "a-very-long-password"))
      .thenReturn("newuser");
    Authentication createdAuthentication = UsernamePasswordAuthenticationToken.authenticated(
      "newuser",
      null,
      AuthorityUtils.createAuthorityList("ROLE_USER")
    );
    when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
      .thenReturn(createdAuthentication);

    var response = controller.register(
      new AuthController.RegistrationRequest("NewUser", "New@Example.com", "a-very-long-password"),
      request,
      mock(HttpServletResponse.class)
    );

    assertEquals(HttpStatus.CREATED, response.getStatusCode());
    assertEquals(Map.of("username", "newuser"), response.getBody());
    assertEquals("newuser", SecurityContextHolder.getContext().getAuthentication().getName());
    verify(userAccountService).register("NewUser", "New@Example.com", "a-very-long-password");
  }

  private static HttpServletRequest requestFrom(String address) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getRemoteAddr()).thenReturn(address);
    return request;
  }
}
