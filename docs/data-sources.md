# Data Sources

All data used in PathwayIQ is open, publicly available, and properly attributed in the product UI.

| Source | Data | Licence | Update cadence | Used in |
|---|---|---|---|---|
| [Jobs and Skills Australia (JSA)](https://www.jobsandskills.gov.au) | Occupation shortage list, job demand forecasts, salary medians | Open Government Licence | Quarterly | Epics 1, 3, 6 |
| [DESE Graduate Outcomes Survey](https://www.dewr.gov.au) | Graduate salary by qualification and field | CC BY 4.0 | Annual | Epic 4, 7 |
| [NCVER](https://www.ncver.edu.au) | TAFE enrolments, apprenticeship completion rates | CC BY | Annual | Epics 4, 7 |
| [VTAC](https://vtac.edu.au) | Course ATAR cutoffs, course-to-career pathways | Public data | Annual (Jan) | Epic 4 |
| [ABS](https://www.abs.gov.au) | Occupation automation exposure index | CC BY 4.0 | Annual | Epic 6 |
| [Oxford Future of Employment](https://www.oxfordmartin.ox.ac.uk) | AI displacement probability by occupation | Academic use | 2013 (mapped to ANZSCO) | Epic 6 |

---

## Attribution displayed in product

Per Epic 8.2 (data transparency), every data field in the career modal shows its source label.  
The footer displays: *"Data sourced from JSA, DESE, NCVER, and OECD. Last updated: [dataset release date]"*

---

## Raw file naming convention

Place raw source files in `data/raw/` (gitignored):

```
jsa_shortage_list.csv
jsa_labour_market_insights.csv
dese_graduate_outcomes.csv
ncver_tafe_pathways.csv
vtac_course_data.csv
abs_automation_index.csv
oxford_employment_future.csv
```
