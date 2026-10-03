# Recorded API fixtures

These files are real responses from the Feature 003 catalog API, recorded from the seeded
development backend. The mock API (`tests/mock-api/server.mjs`) serves them and the contract
tests parse them. Do not edit them by hand.

To re-record, start the seeded backend (`specs/004-catalog-api-integration/quickstart.md`
section 1), then from `frontend/` run:

```cmd
npm run api:record
```

IDs are random UUIDs per database, so a re-record changes every `id`. Review the diff before committing.
