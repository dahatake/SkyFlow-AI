---
name: add-language
description: Add a UI language.
---
1. Extend `Lang` and `LANGS` in `app/src/i18n/core.ts`.
2. Add the new language field to `Entry` and to every `register({...})` entry in `app/src/i18n/dict-*.ts`.
3. `npm test` (i18n test checks completeness and placeholder parity).
