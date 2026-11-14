-- Run once on databases created before idx_poems_public_overview was added.
-- Covers published poem/author counts and the latest import date.
ALTER TABLE poems
    ADD INDEX idx_poems_public_overview (status, author_id, imported_at),
    ALGORITHM=INPLACE,
    LOCK=NONE;
