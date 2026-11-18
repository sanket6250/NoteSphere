package com.notesphere;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
@SpringBootTest(properties = {
  "app.s3.endpoint=http://minio:9000",
  "app.s3.access-key=test-access-key",
  "app.s3.secret-key=test-secret-key",
  "app.s3.bucket=notesphere-test"
})
class NoteSphereApplicationTests { @Test void contextLoads() {} }
