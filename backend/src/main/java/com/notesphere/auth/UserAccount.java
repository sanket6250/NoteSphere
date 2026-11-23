package com.notesphere.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
  name = "users",
  uniqueConstraints = {
    @UniqueConstraint(name = "uq_users_username", columnNames = "username"),
    @UniqueConstraint(name = "uq_users_email", columnNames = "email"),
    @UniqueConstraint(name = "uq_users_account_slot", columnNames = "account_slot")
  }
)
public class UserAccount implements UserDetails {
  @Id
  private UUID id;

  @Column(nullable = false, length = 32)
  private String username;

  @Column(nullable = false, length = 254)
  private String email;

  @Column(name = "password_hash", nullable = false, length = 100)
  private String passwordHash;

  @Column(nullable = false)
  private Instant createdAt;

  @Column(nullable = false)
  private Instant updatedAt;

  @Column(nullable = false)
  private boolean enabled;

  @Column(name = "account_slot", nullable = false, updatable = false)
  private short accountSlot = 1;

  protected UserAccount() {}

  public UserAccount(String username, String email, String passwordHash) {
    this.id = UUID.randomUUID();
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;
    this.enabled = true;
  }

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = createdAt;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public UUID getId() { return id; }
  public String getEmail() { return email; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public short getAccountSlot() { return accountSlot; }

  @Override
  public String getUsername() {
    return username;
  }

  @Override
  public String getPassword() {
    return passwordHash;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_USER"));
  }

  @Override public boolean isAccountNonExpired() { return true; }
  @Override public boolean isAccountNonLocked() { return true; }
  @Override public boolean isCredentialsNonExpired() { return true; }
  @Override public boolean isEnabled() { return enabled; }
}
