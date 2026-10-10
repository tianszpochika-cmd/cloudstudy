-- R1-020 stores an accepted placement answer before R1-021 scores it.
-- NULL means received and not yet graded. It is neither FULL nor ZERO.
ALTER TABLE p1_placement_response
    MODIFY COLUMN correct BOOLEAN NULL;
