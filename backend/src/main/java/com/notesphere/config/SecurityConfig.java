package com.notesphere.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.http.HttpStatus;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
  }

  @Bean
  UserDetailsService userDetailsService(
    @Value("${app.auth.username}") String username,
    @Value("${app.auth.password}") String password,
    PasswordEncoder encoder
  ) {
    return new InMemoryUserDetailsManager(
      User.withUsername(username).password(encoder.encode(password)).roles("USER").build()
    );
  }

  @Bean
  AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
    return configuration.getAuthenticationManager();
  }

  @Bean
  SecurityContextRepository securityContextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  CookieCsrfTokenRepository csrfTokenRepository(
    @Value("${server.servlet.session.cookie.secure:false}") boolean secure
  ) {
    CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
    repository.setCookieCustomizer(cookie -> cookie.path("/").secure(secure).sameSite("Lax"));
    return repository;
  }

  @Bean
  SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    SecurityContextRepository contextRepository,
    CookieCsrfTokenRepository csrfTokenRepository
  ) throws Exception {
    http
      .cors(Customizer.withDefaults())
      .csrf(csrf -> csrf.csrfTokenRepository(csrfTokenRepository))
      .securityContext(context -> context.securityContextRepository(contextRepository))
      .authorizeHttpRequests(authorize -> authorize
        .requestMatchers("/api/auth/csrf", "/api/auth/login", "/actuator/health/**").permitAll()
        .anyRequest().authenticated()
      )
      .exceptionHandling(errors -> errors.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
      .requestCache(cache -> cache.disable())
      .formLogin(form -> form.disable())
      .httpBasic(basic -> basic.disable());
    return http.build();
  }
}
