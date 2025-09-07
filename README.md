# DistrictArc Assessments — Full Build

## Run
```bash
npm i
npm run dev
# http://localhost:3000
```

## Data
Place .xlsx in:
```
data/state_score_public_districtarc/
  ELA/{city,borough,district,school}/
  Math/{city,borough,district,school}/
```
Sheets must be named e.g. `ELA - All`, `ELA - SWD`, `ELA - Ethnicity`, `ELA - Gender`, `ELA - Econ Status`, `ELA - ELL` (and Math versions).

## Env override
```bash
DATA_DIR=/path/to/state_score_public_districtarc npm run dev
```
