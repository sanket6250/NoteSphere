package com.notesphere.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WebConfigTest {
  @Test
  void productionAllowsOneExactHttpsOriginAndSameOriginMode() {
    MockEnvironment production = productionEnvironment();

    assertDoesNotThrow(() -> new WebConfig("https://notes.example.com", production).validateProductionOrigin());
    assertDoesNotThrow(() -> new WebConfig("", production).validateProductionOrigin());
  }

  @Test
  void productionRejectsWildcardListsAndNonHttpsOrigins() {
    MockEnvironment production = productionEnvironment();

    for (String origin : new String[] {
      "*",
      "https://notes.example.com,https://other.example.com",
      "http://notes.example.com",
      "https://notes.example.com/path"
    }) {
      assertThrows(IllegalStateException.class, () -> new WebConfig(origin, production).validateProductionOrigin());
    }
  }

  private static MockEnvironment productionEnvironment() {
    MockEnvironment environment = new MockEnvironment();
    environment.setActiveProfiles("prod");
    return environment;
  }
}
