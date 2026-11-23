package com.notesphere.config;

import com.notesphere.auth.UserAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository contextRepository;
  private final LoginAttemptThrottle loginAttemptThrottle;
  private final UserAccountService userAccountService;

  public AuthController(
    AuthenticationManager authenticationManager,
    SecurityContextRepository contextRepository,
    LoginAttemptThrottle loginAttemptThrottle,
    UserAccountService userAccountService
  ) {
    this.authenticationManager = authenticationManager;
    this.contextRepository = contextRepository;
    this.loginAttemptThrottle = loginAttemptThrottle;
    this.userAccountService = userAccountService;
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
  }

  @GetMapping("/session")
  public Map<String, String> session(Authentication authentication) {
    return Map.of("username", authentication.getName());
  }

  @GetMapping("/registration")
  public Map<String, Boolean> registrationStatus() {
    return Map.of("available", userAccountService.isRegistrationAvailable());
  }

  @PostMapping("/login")
  public Map<String, String> login(
    @Valid @RequestBody LoginRequest requestBody,
    HttpServletRequest request,
    HttpServletResponse response
  ) {
    logger.info("Login request reached controller");
    String username = requestBody.username().trim().toLowerCase(Locale.ROOT);
    String clientAddress = request.getRemoteAddr();
    if (loginAttemptThrottle.isBlocked(clientAddress)) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Try again later.");
    }

    Authentication authentication;
    try {
      authentication = authenticationManager.authenticate(
        UsernamePasswordAuthenticationToken.unauthenticated(username, requestBody.password())
      );
    } catch (AuthenticationException exception) {
      loginAttemptThrottle.recordFailure(clientAddress);
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password.");
    }

    loginAttemptThrottle.recordSuccess(clientAddress);
    saveAuthenticatedSession(authentication, request, response);
    return Map.of("username", authentication.getName());
  }

  @PostMapping("/register")
  public ResponseEntity<Map<String, String>> register(
    @Valid @RequestBody RegistrationRequest requestBody,
    HttpServletRequest request,
    HttpServletResponse response
  ) {
    logger.info("Registration request reached controller");
    String username;
    try {
      username = userAccountService.register(
        requestBody.username(),
        requestBody.email(),
        requestBody.password()
      );
    } catch (UserAccountService.RegistrationClosedException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
    } catch (UserAccountService.InvalidRegistrationException exception) {
      return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }

    Authentication authentication = authenticationManager.authenticate(
      UsernamePasswordAuthenticationToken.unauthenticated(username, requestBody.password())
    );
    saveAuthenticatedSession(authentication, request, response);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("username", authentication.getName()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> invalidRequest(MethodArgumentNotValidException exception) {
    String message = exception.getBindingResult().getFieldErrors().stream()
      .map(FieldError::getDefaultMessage)
      .filter(value -> value != null && !value.isBlank())
      .findFirst()
      .orElse("Please check the account details and try again.");
    return ResponseEntity.badRequest()
      .header(HttpHeaders.CACHE_CONTROL, "no-store")
      .body(Map.of("message", message));
  }

  @PostMapping("/logout")
  public void logout(HttpServletRequest request, HttpServletResponse response) {
    SecurityContextHolder.clearContext();
    if (request.getSession(false) != null) request.getSession(false).invalidate();
    contextRepository.saveContext(SecurityContextHolder.createEmptyContext(), request, response);
  }

  private void saveAuthenticatedSession(
    Authentication authentication,
    HttpServletRequest request,
    HttpServletResponse response
  ) {
    request.getSession(true);
    request.changeSessionId();
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    contextRepository.saveContext(context, request, response);
  }

  public record LoginRequest(
    @NotBlank(message = "Enter your username or email.")
    @Size(max = 254, message = "Username or email is too long.")
    String username,
    @NotBlank(message = "Enter your password.")
    String password
  ) {}

  public record RegistrationRequest(
    @NotBlank(message = "Enter a username.")
    @Size(min = 3, max = 32, message = "Username must be 3 to 32 characters.")
    @Pattern(regexp = "[A-Za-z0-9._-]+", message = "Username can use letters, numbers, dots, underscores, and hyphens.")
    String username,
    @NotBlank(message = "Enter your email address.")
    @Email(message = "Enter a valid email address.")
    @Size(max = 254, message = "Email address is too long.")
    String email,
    @NotBlank(message = "Enter a password.")
    @Size(min = 12, max = 72, message = "Password must be 12 to 72 characters.")
    String password
  ) {}
}
