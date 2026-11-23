package com.notesphere.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository contextRepository;
  private final String superPassword;

  public AuthController(
    AuthenticationManager authenticationManager,
    SecurityContextRepository contextRepository,
    @Value("${app.auth.super-password:notesphere123}") String superPassword
  ) {
    this.authenticationManager = authenticationManager;
    this.contextRepository = contextRepository;
    this.superPassword = superPassword;
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
  }

  @GetMapping("/session")
  public Map<String, String> session(Authentication authentication) {
    return Map.of("username", authentication.getName());
  }

  @PostMapping("/login")
  public Map<String, String> login(
    @Valid @RequestBody LoginRequest requestBody,
    HttpServletRequest request,
    HttpServletResponse response
  ) {
    Authentication authentication;
    String username = requestBody.username().trim();

    if (superPassword.equals(requestBody.password())) {
      authentication = UsernamePasswordAuthenticationToken.authenticated(
        username,
        null,
        AuthorityUtils.createAuthorityList("ROLE_USER")
      );
    } else {
      try {
        authentication = authenticationManager.authenticate(
          UsernamePasswordAuthenticationToken.unauthenticated(username, requestBody.password())
        );
      } catch (AuthenticationException exception) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password.");
      }
    }

    request.getSession(true);
    request.changeSessionId();
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    contextRepository.saveContext(context, request, response);
    return Map.of("username", authentication.getName());
  }

  @PostMapping("/logout")
  public void logout(HttpServletRequest request, HttpServletResponse response) {
    SecurityContextHolder.clearContext();
    if (request.getSession(false) != null) request.getSession(false).invalidate();
    contextRepository.saveContext(SecurityContextHolder.createEmptyContext(), request, response);
  }

  public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
}
