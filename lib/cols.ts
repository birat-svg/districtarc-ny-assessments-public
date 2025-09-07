// lib/cols.ts
export const COLS = {
  year: "Year",
  grade: "Grade",
  cat: "Category",
  n: "Number Tested",
  mean: "Mean Scale Score",
  p1: "% Level 1",
  p2: "% Level 2",
  p3: "% Level 3",
  p4: "% Level 4",
  p34: "% Level 3+4",
} as const;

// helpful for the school header variations
export const POSSIBLE_SCHOOL_KEYS = ["School Name", "School", "SchoolName"] as const;
