package com.notesphere.storage;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
@RestController @RequestMapping("/api/attachments")
public class AttachmentController {
 private static final Set<String> INLINE_IMAGE_TYPES = Set.of("avif","bmp","gif","jpeg","png","webp");
 private final MinioClient client; private final String bucket;
 public AttachmentController(MinioClient client,@Value("${app.s3.bucket}") String bucket){this.client=client;this.bucket=bucket;}
 @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public Map<String,String> upload(@RequestParam("file") MultipartFile file) throws Exception {
  if(file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Empty file");
  if(file.getSize()>25L*1024*1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Max file size is 25MB");
  String id=UUID.randomUUID().toString(); String name=sanitizeFileName(file.getOriginalFilename()==null?"attachment":file.getOriginalFilename());
  String key=id+"/"+name;
  String contentType=file.getContentType()==null||file.getContentType().isBlank()?MediaType.APPLICATION_OCTET_STREAM_VALUE:file.getContentType();
  client.putObject(PutObjectArgs.builder().bucket(bucket).object(key).stream(file.getInputStream(),file.getSize(),-1).contentType(contentType).build());
  return Map.of("id",id,"fileName",name,"objectKey",key,"size",String.valueOf(file.getSize()),"contentType",contentType);
 }
 @GetMapping("/{id}")
 public ResponseEntity<byte[]> download(
  @PathVariable String id,
  @RequestParam String key,
  @RequestParam(defaultValue="attachment") String fileName,
  @RequestParam(defaultValue="false") boolean inline
 ) throws Exception {
  if(!key.startsWith(id+"/")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid object key");

  StatObjectResponse metadata=client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build());
  String storedContentType=metadata.contentType();
  MediaType contentType=storedContentType==null||storedContentType.isBlank()
   ? MediaType.APPLICATION_OCTET_STREAM
   : MediaType.parseMediaType(storedContentType);
  boolean rasterImage=contentType.getType().equalsIgnoreCase("image")
   &&INLINE_IMAGE_TYPES.contains(contentType.getSubtype().toLowerCase(Locale.ROOT));
  boolean pdf=contentType.getType().equalsIgnoreCase("application")&&contentType.getSubtype().equalsIgnoreCase("pdf");
  boolean showInline=inline&&(rasterImage||pdf);
  String safeName=sanitizeFileName(fileName);
  String disposition=ContentDisposition.builder(showInline?"inline":"attachment")
   .filename(safeName,StandardCharsets.UTF_8).build().toString();

  try(InputStream in=client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build())){
   byte[] bytes=in.readAllBytes();
   return ResponseEntity.ok()
    .contentType(contentType)
    .header(HttpHeaders.CONTENT_DISPOSITION,disposition)
    .header("X-Content-Type-Options","nosniff")
    .body(bytes);
  }
 }
 @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable String id,@RequestParam String key) throws Exception {
  if(!key.startsWith(id+"/")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid object key");
  client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
 }
 private String sanitizeFileName(String fileName){return fileName.replaceAll("[\\\\/\\r\\n\"]","_");}
}
