-- Run once on databases created before idx_poems_public_latest was added.
-- Covers the published-only latest sort, including its stable UUID tie-breaker.
ALTER TABLE poems
    ADD INDEX idx_poems_public_latest (status, created_at DESC, id),
    ALGORITHM=INPLACE,
    LOCK=NONE;
