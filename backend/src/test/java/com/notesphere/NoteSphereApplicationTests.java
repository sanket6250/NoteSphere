package com.notesphere;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
@SpringBootTest(properties = {
  "app.auth.username=test-user",
  "app.auth.password=test-password"
})
class NoteSphereApplicationTests { @Test void contextLoads() {} }
