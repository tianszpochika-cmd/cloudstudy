# rv1 evidence

suffix: a749da72
directory: evidence/redesign/2026-10-11/it6-persist-rv1-a749da72

- PASS ports-free
- PASS dedicated-schemas
- PASS iam-https
- PASS it6-simple-chain
- PASS it6-restart-fingerprint
- SKIP it6-full-browser
- FAIL minor-year-web-1280
- FAIL minor-year-web-390
- PASS minor-year-h5-390
- PASS minor-year-h5-1280
- FAIL withdraw-web-1280
- FAIL withdraw-h5-390
- FAIL node-suite
- PASS schemas-dropped
- PASS qida-unchanged

failed: minor-year-web-1280, minor-year-web-390, withdraw-web-1280, withdraw-h5-390, node-suite
