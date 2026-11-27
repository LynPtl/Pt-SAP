# pt-sap

Private research tooling for a text auto-battler inspired by Super Auto Pets.

## Scope

- Scrape the community Super Auto Pets wiki into `reference/` (gitignored).
- Parse pet infoboxes and food rows into normalized JSON.
- Produce a Turtle Pack coverage report showing how much of the ability set maps
  to a small, deterministic effect DSL.

No game client, assets, or SAP names are intended for publication from this repo.

## Commands

```bash
npm install
npm run coverage   # scrape + normalize + report
npm run typecheck
npm test
```

## Outputs

- `reference/raw/turtle-pack-pages.json` — cached wikitext
- `reference/normalized/turtle-pack.json` — normalized pets
- `reference/normalized/turtle-pack-foods.json` — normalized foods
- `reports/turtle-pack-coverage.md` — coverage report

## Licensing

- Code: MIT
- Generated original data/text later: CC0-1.0 or MIT
- `reference/` is a private research cache and must not be committed or shipped.
