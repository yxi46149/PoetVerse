-- Run once on databases created before the public filter indexes were added.
-- Covers dynasty, form, and author filters together with publication status.
ALTER TABLE poems
    ADD INDEX idx_poems_dynasty_public (dynasty, status),
    ADD INDEX idx_poems_form_public (form, status),
    ADD INDEX idx_poems_author_public (author_name, status),
    ALGORITHM=INPLACE,
    LOCK=NONE;
