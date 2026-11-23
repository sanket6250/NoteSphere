package com.notesphere.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
  boolean existsByAccountSlot(short accountSlot);

  @Query("""
    select account from UserAccount account
    where account.username = :identifier or account.email = :identifier
    """)
  Optional<UserAccount> findByIdentifier(@Param("identifier") String identifier);
}
