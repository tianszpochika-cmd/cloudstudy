-- Forward-only correction for legacy fixtures that were marked PUBLISHED without canonical
-- content version/rights provenance. Values remain in place for audit and later reconciliation.
-- B3 IDs are the exact unique roster from V7, V11 and V20; owner metadata guards protect drift.
UPDATE b3_content_experience
   SET availability = 'UNPUBLISHED'
 WHERE tenant_id = 'platform'
   AND experience_id LIKE 'b3-%'
   AND (experience_id, domain_code, resource_type, resource_key) IN (
       ('b3-grammar-exercise-3701', 'GRAMMAR', 'GRAMMAR_EXERCISE', '3701'),
       ('b3-grammar-exercise-3702', 'GRAMMAR', 'GRAMMAR_EXERCISE', '3702'),
       ('b3-grammar-point-3101', 'GRAMMAR', 'GRAMMAR_POINT', '3101'),
       ('b3-grammar-point-3103', 'GRAMMAR', 'GRAMMAR_POINT', '3103'),
       ('b3-grammar-sentence-3201', 'GRAMMAR', 'SENTENCE', '3201'),
       ('b3-listening-clip-3410', 'LISTENING', 'LISTENING_CLIP', '3410'),
       ('b3-listening-material-3401', 'LISTENING', 'LISTENING_MATERIAL', '3401'),
       ('b3-phonetics-3601', 'PHONETICS', 'PHONEME', '3601'),
       ('b3-phonetics-3603', 'PHONETICS', 'PHONEME', '3603'),
       ('b3-phonetics-3604', 'PHONETICS', 'PHONEME', '3604'),
       ('b3-phonetics-3605', 'PHONETICS', 'PHONEME', '3605'),
       ('b3-phonetics-3606', 'PHONETICS', 'PHONEME', '3606'),
       ('b3-phonetics-3607', 'PHONETICS', 'PHONEME', '3607'),
       ('b3-phonetics-3608', 'PHONETICS', 'PHONEME', '3608'),
       ('b3-phonetics-3609', 'PHONETICS', 'PHONEME', '3609'),
       ('b3-phonetics-3610', 'PHONETICS', 'PHONEME', '3610'),
       ('b3-phonetics-3611', 'PHONETICS', 'PHONEME', '3611'),
       ('b3-phonetics-3612', 'PHONETICS', 'PHONEME', '3612'),
       ('b3-phonetics-3613', 'PHONETICS', 'PHONEME', '3613'),
       ('b3-phonetics-3614', 'PHONETICS', 'PHONEME', '3614'),
       ('b3-phonetics-3615', 'PHONETICS', 'PHONEME', '3615'),
       ('b3-phonetics-3616', 'PHONETICS', 'PHONEME', '3616'),
       ('b3-phonetics-3617', 'PHONETICS', 'PHONEME', '3617'),
       ('b3-phonetics-3618', 'PHONETICS', 'PHONEME', '3618'),
       ('b3-phonetics-3619', 'PHONETICS', 'PHONEME', '3619'),
       ('b3-phonetics-3620', 'PHONETICS', 'PHONEME', '3620'),
       ('b3-phonetics-3621', 'PHONETICS', 'PHONEME', '3621'),
       ('b3-phonetics-3622', 'PHONETICS', 'PHONEME', '3622'),
       ('b3-phonetics-3623', 'PHONETICS', 'PHONEME', '3623'),
       ('b3-phonetics-3624', 'PHONETICS', 'PHONEME', '3624'),
       ('b3-phonetics-3625', 'PHONETICS', 'PHONEME', '3625'),
       ('b3-phonetics-3626', 'PHONETICS', 'PHONEME', '3626'),
       ('b3-phonetics-3627', 'PHONETICS', 'PHONEME', '3627'),
       ('b3-phonetics-3628', 'PHONETICS', 'PHONEME', '3628'),
       ('b3-phonetics-3629', 'PHONETICS', 'PHONEME', '3629'),
       ('b3-phonetics-3630', 'PHONETICS', 'PHONEME', '3630'),
       ('b3-phonetics-3631', 'PHONETICS', 'PHONEME', '3631'),
       ('b3-phonetics-3632', 'PHONETICS', 'PHONEME', '3632'),
       ('b3-phonetics-3633', 'PHONETICS', 'PHONEME', '3633'),
       ('b3-phonetics-3634', 'PHONETICS', 'PHONEME', '3634'),
       ('b3-phonetics-3635', 'PHONETICS', 'PHONEME', '3635'),
       ('b3-phonetics-3636', 'PHONETICS', 'PHONEME', '3636'),
       ('b3-phonetics-3637', 'PHONETICS', 'PHONEME', '3637'),
       ('b3-phonetics-3638', 'PHONETICS', 'PHONEME', '3638'),
       ('b3-phonetics-3639', 'PHONETICS', 'PHONEME', '3639'),
       ('b3-phonetics-3640', 'PHONETICS', 'PHONEME', '3640'),
       ('b3-phonetics-3641', 'PHONETICS', 'PHONEME', '3641'),
       ('b3-phonetics-3642', 'PHONETICS', 'PHONEME', '3642'),
       ('b3-phonetics-3643', 'PHONETICS', 'PHONEME', '3643'),
       ('b3-phonetics-3644', 'PHONETICS', 'PHONEME', '3644'),
       ('b3-phonetics-3645', 'PHONETICS', 'PHONEME', '3645'),
       ('b3-phonetics-3646', 'PHONETICS', 'PHONEME', '3646'),
       ('b3-phonetics-3647', 'PHONETICS', 'PHONEME', '3647'),
       ('b3-phonetics-3648', 'PHONETICS', 'PHONEME', '3648'),
       ('b3-phonetics-3649', 'PHONETICS', 'PHONEME', '3649'),
       ('b3-phonetics-3960', 'PHONETICS', 'MINIMAL_PAIR', '3960'),
       ('b3-phonetics-3961', 'PHONETICS', 'MINIMAL_PAIR', '3961'),
       ('b3-phonetics-3962', 'PHONETICS', 'MINIMAL_PAIR', '3962'),
       ('b3-phonetics-3963', 'PHONETICS', 'MINIMAL_PAIR', '3963'),
       ('b3-phonetics-3964', 'PHONETICS', 'MINIMAL_PAIR', '3964'),
       ('b3-phonetics-3965', 'PHONETICS', 'MINIMAL_PAIR', '3965'),
       ('b3-phonetics-3966', 'PHONETICS', 'MINIMAL_PAIR', '3966'),
       ('b3-phonetics-3967', 'PHONETICS', 'MINIMAL_PAIR', '3967'),
       ('b3-phonetics-3968', 'PHONETICS', 'MINIMAL_PAIR', '3968'),
       ('b3-phonetics-fr-3650', 'PHONETICS-FR', 'PHONEME', '3650'),
       ('b3-phonetics-fr-3651', 'PHONETICS-FR', 'PHONEME', '3651'),
       ('b3-phonetics-fr-3652', 'PHONETICS-FR', 'PHONEME', '3652'),
       ('b3-phonetics-fr-3653', 'PHONETICS-FR', 'PHONEME', '3653'),
       ('b3-phonetics-fr-3654', 'PHONETICS-FR', 'PHONEME', '3654'),
       ('b3-phonetics-fr-3655', 'PHONETICS-FR', 'PHONEME', '3655'),
       ('b3-phonetics-fr-3656', 'PHONETICS-FR', 'PHONEME', '3656'),
       ('b3-phonetics-fr-3657', 'PHONETICS-FR', 'PHONEME', '3657'),
       ('b3-phonetics-fr-3658', 'PHONETICS-FR', 'PHONEME', '3658'),
       ('b3-phonetics-fr-3659', 'PHONETICS-FR', 'PHONEME', '3659'),
       ('b3-phonetics-fr-3660', 'PHONETICS-FR', 'PHONEME', '3660'),
       ('b3-phonetics-fr-3661', 'PHONETICS-FR', 'PHONEME', '3661'),
       ('b3-phonetics-fr-3662', 'PHONETICS-FR', 'PHONEME', '3662'),
       ('b3-phonetics-fr-3663', 'PHONETICS-FR', 'PHONEME', '3663'),
       ('b3-phonetics-fr-3664', 'PHONETICS-FR', 'PHONEME', '3664'),
       ('b3-phonetics-fr-3665', 'PHONETICS-FR', 'PHONEME', '3665'),
       ('b3-phonetics-fr-3666', 'PHONETICS-FR', 'PHONEME', '3666'),
       ('b3-phonetics-fr-3667', 'PHONETICS-FR', 'PHONEME', '3667'),
       ('b3-phonetics-fr-3668', 'PHONETICS-FR', 'PHONEME', '3668'),
       ('b3-phonetics-fr-3669', 'PHONETICS-FR', 'PHONEME', '3669'),
       ('b3-phonetics-fr-3670', 'PHONETICS-FR', 'PHONEME', '3670'),
       ('b3-phonetics-fr-3671', 'PHONETICS-FR', 'PHONEME', '3671'),
       ('b3-phonetics-fr-3672', 'PHONETICS-FR', 'PHONEME', '3672'),
       ('b3-phonetics-fr-3673', 'PHONETICS-FR', 'PHONEME', '3673'),
       ('b3-phonetics-fr-3674', 'PHONETICS-FR', 'PHONEME', '3674'),
       ('b3-phonetics-fr-3675', 'PHONETICS-FR', 'PHONEME', '3675'),
       ('b3-phonetics-fr-3676', 'PHONETICS-FR', 'PHONEME', '3676'),
       ('b3-phonetics-fr-3677', 'PHONETICS-FR', 'PHONEME', '3677'),
       ('b3-phonetics-fr-3678', 'PHONETICS-FR', 'PHONEME', '3678'),
       ('b3-phonetics-fr-3679', 'PHONETICS-FR', 'PHONEME', '3679'),
       ('b3-phonetics-fr-3680', 'PHONETICS-FR', 'PHONEME', '3680'),
       ('b3-phonetics-fr-3681', 'PHONETICS-FR', 'PHONEME', '3681'),
       ('b3-phonetics-fr-3682', 'PHONETICS-FR', 'PHONEME', '3682'),
       ('b3-phonetics-fr-3683', 'PHONETICS-FR', 'PHONEME', '3683'),
       ('b3-phonetics-fr-3684', 'PHONETICS-FR', 'PHONEME', '3684'),
       ('b3-phonetics-fr-3685', 'PHONETICS-FR', 'PHONEME', '3685'),
       ('b3-phonetics-fr-3686', 'PHONETICS-FR', 'PHONEME', '3686'),
       ('b3-phonetics-fr-3970', 'PHONETICS-FR', 'MINIMAL_PAIR', '3970'),
       ('b3-phonetics-fr-3971', 'PHONETICS-FR', 'MINIMAL_PAIR', '3971'),
       ('b3-phonetics-fr-3972', 'PHONETICS-FR', 'MINIMAL_PAIR', '3972'),
       ('b3-phonetics-fr-3973', 'PHONETICS-FR', 'MINIMAL_PAIR', '3973'),
       ('b3-reading-article-3501', 'READING', 'READING_ARTICLE', '3501'),
       ('b3-reading-dictionary-3501-small', 'READING', 'DICTIONARY_ENTRY', '3501:small'),
       ('b3-reading-question-3950', 'READING', 'READING_QUESTION', '3950'),
       ('b3-writing-material-3910', 'WRITING', 'WRITING_MATERIAL', '3910'),
       ('b3-writing-prompt-3301', 'WRITING', 'WRITING_PROMPT', '3301'),
       ('b3-writing-prompt-3303', 'WRITING', 'WRITING_PROMPT', '3303'),
       ('b3-writing-proofreading-3920', 'WRITING', 'PROOFREADING', '3920'),
       ('b3-writing-template-3901', 'WRITING', 'WRITING_TEMPLATE', '3901')
   )
   AND content_version_id = 301
   AND availability = 'PUBLISHED'
   AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.contentVersionId')) = '301'
   AND NOT EXISTS (
       SELECT 1
         FROM content_version canonical_version
         JOIN content_definition canonical_content
           ON canonical_content.content_id = canonical_version.content_id
          AND canonical_content.current_published_version_id = canonical_version.content_version_id
        WHERE canonical_version.content_version_id = b3_content_experience.content_version_id
          AND canonical_version.status = 'PUBLISHED'
          AND canonical_version.published_at IS NOT NULL
          AND canonical_version.copyright_status = 'ACTIVE'
          AND canonical_version.rights_allows_learning = TRUE
          AND NULLIF(TRIM(canonical_version.rights_source_code), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.rights_license_code), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.authorization_evidence_ref), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.editor), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.first_reviewer), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.final_reviewer), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.publisher), '') IS NOT NULL
          AND canonical_version.editor <> canonical_version.first_reviewer
          AND canonical_version.editor <> canonical_version.final_reviewer
          AND canonical_version.editor <> canonical_version.publisher
          AND canonical_version.first_reviewer <> canonical_version.final_reviewer
          AND canonical_version.first_reviewer <> canonical_version.publisher
          AND canonical_version.final_reviewer <> canonical_version.publisher
          AND (canonical_version.rights_starts_at IS NULL
               OR canonical_version.rights_starts_at <= CURRENT_TIMESTAMP(6))
          AND (canonical_version.rights_expires_at IS NULL
               OR canonical_version.rights_expires_at > CURRENT_TIMESTAMP(6))
          AND canonical_version.rights_permitted_channels IS NOT NULL
          AND (JSON_CONTAINS(canonical_version.rights_permitted_channels, '"LEARNER"')
               OR JSON_CONTAINS(canonical_version.rights_permitted_channels, '"*"'))
   );

-- The B25 vocabulary row can remain published only when its owning unit and course are both
-- published, rights-valid, and bound to the same canonical content version.
UPDATE b25_content_vocabulary
   SET availability = 'UNPUBLISHED'
 WHERE vocabulary_id = 'b25-item-001'
   AND unit_code = 'unit-b25-foundations'
   AND word_normalized = 'hello'
   AND meaning_key = 'greeting.hello'
   AND cefr_level = 'A1'
   AND content_version = 25001
   AND audio_ref = 'fixture/core-foundation/audio-placeholder-v1'
   AND availability = 'PUBLISHED'
   AND NOT EXISTS (
       SELECT 1
         FROM b25_content_unit owner_unit
         JOIN b25_content_course owner_course
           ON owner_course.content_code = owner_unit.course_code
         JOIN content_version canonical_version
           ON canonical_version.content_version_id = owner_course.content_version_id
         JOIN content_definition canonical_content
           ON canonical_content.content_id = canonical_version.content_id
          AND canonical_content.current_published_version_id = canonical_version.content_version_id
        WHERE owner_unit.unit_code = b25_content_vocabulary.unit_code
          AND owner_unit.content_version = b25_content_vocabulary.content_version
          AND owner_unit.availability = 'PUBLISHED'
          AND owner_unit.rights_status = 'VALID'
          AND owner_course.tenant_id = 'platform'
          AND owner_course.content_version_id = b25_content_vocabulary.content_version
          AND owner_course.availability = 'PUBLISHED'
          AND owner_course.rights_status = 'VALID'
          AND canonical_version.status = 'PUBLISHED'
          AND canonical_version.published_at IS NOT NULL
          AND canonical_version.copyright_status = 'ACTIVE'
          AND canonical_version.rights_allows_learning = TRUE
          AND NULLIF(TRIM(canonical_version.rights_source_code), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.rights_license_code), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.authorization_evidence_ref), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.editor), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.first_reviewer), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.final_reviewer), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.publisher), '') IS NOT NULL
          AND canonical_version.editor <> canonical_version.first_reviewer
          AND canonical_version.editor <> canonical_version.final_reviewer
          AND canonical_version.editor <> canonical_version.publisher
          AND canonical_version.first_reviewer <> canonical_version.final_reviewer
          AND canonical_version.first_reviewer <> canonical_version.publisher
          AND canonical_version.final_reviewer <> canonical_version.publisher
          AND (canonical_version.rights_starts_at IS NULL
               OR canonical_version.rights_starts_at <= CURRENT_TIMESTAMP(6))
          AND (canonical_version.rights_expires_at IS NULL
               OR canonical_version.rights_expires_at > CURRENT_TIMESTAMP(6))
          AND canonical_version.rights_permitted_channels IS NOT NULL
          AND (JSON_CONTAINS(canonical_version.rights_permitted_channels, '"LEARNER"')
               OR JSON_CONTAINS(canonical_version.rights_permitted_channels, '"*"'))
   );

-- The B2 chunk has no rights columns of its own; keep it unavailable unless its referenced
-- canonical version is the current published version and carries active learner distribution rights.
UPDATE b2_content_chunk
   SET availability = 'UNPUBLISHED'
 WHERE chunk_id = 32001
   AND tenant_id = 'platform'
   AND canonical_text = 'build a habit'
   AND chunk_type = 'COLLOCATION'
   AND meaning_cn = '养成一个习惯'
   AND scenario_code = 'DAILY_ROUTINE'
   AND content_version = '25001'
   AND availability = 'PUBLISHED'
   AND NOT EXISTS (
       SELECT 1
         FROM content_version canonical_version
         JOIN content_definition canonical_content
           ON canonical_content.content_id = canonical_version.content_id
          AND canonical_content.current_published_version_id = canonical_version.content_version_id
        WHERE canonical_version.content_version_id = CAST(b2_content_chunk.content_version AS UNSIGNED)
          AND canonical_version.status = 'PUBLISHED'
          AND canonical_version.published_at IS NOT NULL
          AND canonical_version.copyright_status = 'ACTIVE'
          AND canonical_version.rights_allows_learning = TRUE
          AND NULLIF(TRIM(canonical_version.rights_source_code), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.rights_license_code), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.authorization_evidence_ref), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.editor), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.first_reviewer), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.final_reviewer), '') IS NOT NULL
          AND NULLIF(TRIM(canonical_version.publisher), '') IS NOT NULL
          AND canonical_version.editor <> canonical_version.first_reviewer
          AND canonical_version.editor <> canonical_version.final_reviewer
          AND canonical_version.editor <> canonical_version.publisher
          AND canonical_version.first_reviewer <> canonical_version.final_reviewer
          AND canonical_version.first_reviewer <> canonical_version.publisher
          AND canonical_version.final_reviewer <> canonical_version.publisher
          AND (canonical_version.rights_starts_at IS NULL
               OR canonical_version.rights_starts_at <= CURRENT_TIMESTAMP(6))
          AND (canonical_version.rights_expires_at IS NULL
               OR canonical_version.rights_expires_at > CURRENT_TIMESTAMP(6))
          AND canonical_version.rights_permitted_channels IS NOT NULL
          AND (JSON_CONTAINS(canonical_version.rights_permitted_channels, '"LEARNER"')
               OR JSON_CONTAINS(canonical_version.rights_permitted_channels, '"*"'))
   );
