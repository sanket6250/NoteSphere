package com.notesphere.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public final class AuthRequestDiagnosticFilter extends OncePerRequestFilter {
  private static final Logger logger = LoggerFactory.getLogger(AuthRequestDiagnosticFilter.class);

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getServletPath();
    return !path.endsWith("/auth/register") && !path.endsWith("/auth/login");
  }

  @Override
  protected void doFilterInternal(
    HttpServletRequest request,
    HttpServletResponse response,
    FilterChain filterChain
  ) throws ServletException, IOException {
    String method = request.getMethod();
    String path = request.getServletPath();
    logger.info("Authentication request entered security chain method={} path={}", method, path);
    try {
      filterChain.doFilter(request, response);
    } finally {
      logger.info("Authentication security chain completed method={} path={} status={}",
        method, path, response.getStatus());
    }
  }
}
