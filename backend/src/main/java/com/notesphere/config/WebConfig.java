package com.notesphere.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.net.URI;
import java.util.Arrays;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final String allowedOrigins;
  private final Environment environment;

  public WebConfig(
    @Value("${app.cors.allowed-origins}") String allowedOrigins,
    Environment environment
  ) {
    this.allowedOrigins = allowedOrigins.trim();
    this.environment = environment;
  }

  @PostConstruct
  void validateProductionOrigin() {
    if (!environment.acceptsProfiles(Profiles.of("prod")) || allowedOrigins.isBlank()) return;

    String[] origins = allowedOrigins.split(",", -1);
    if (origins.length != 1) {
      throw new IllegalStateException("APP_CORS_ALLOWED_ORIGINS must contain only the frontend origin in production.");
    }

    try {
      URI origin = URI.create(origins[0].trim());
      if (!"https".equalsIgnoreCase(origin.getScheme())
        || origin.getHost() == null
        || origin.getRawUserInfo() != null
        || origin.getRawPath() != null && !origin.getRawPath().isEmpty()
        || origin.getRawQuery() != null
        || origin.getRawFragment() != null) {
        throw new IllegalStateException("APP_CORS_ALLOWED_ORIGINS must be one HTTPS origin in production.");
      }
    } catch (IllegalArgumentException exception) {
      throw new IllegalStateException("APP_CORS_ALLOWED_ORIGINS must be one HTTPS origin in production.", exception);
    }
  }

  @Override public void addCorsMappings(CorsRegistry registry) {
    if (allowedOrigins.isBlank()) return;
    String[] origins = Arrays.stream(allowedOrigins.split(","))
      .map(String::trim)
      .toArray(String[]::new);
    registry.addMapping("/api/**").allowedOrigins(origins)
      .allowedMethods("GET","POST","PUT","PATCH","DELETE","OPTIONS")
      .allowedHeaders("*")
      .allowCredentials(true);
  }
}
