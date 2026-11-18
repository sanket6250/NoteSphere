package com.notesphere.storage;
import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class S3Config {
 @Bean MinioClient minioClient(@Value("${app.s3.endpoint}") String endpoint,@Value("${app.s3.access-key}") String access,@Value("${app.s3.secret-key}") String secret){
  return MinioClient.builder().endpoint(endpoint).credentials(access,secret).build();
 }
}
