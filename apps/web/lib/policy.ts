export const PROJECT_TEAM_SIZE_MIN = 10;
export const PROJECT_TEAM_SIZE_MAX = 12;
export const TEAM_FINAL_SIZE = 12;

export const DISCIPLINE_OPTIONS = ["SOEN", "COEN", "MECH", "ELEC", "CIVI", "INDY"];

export const SKILL_OPTIONS = [
  "TypeScript",
  "React",
  "Next.js",
  "Go",
  "GraphQL",
  "Python",
  "PostgreSQL",
  "C++",
  "Docker",
  "Svelte",
  "Node.js",
  "Tailwind CSS",
  "Agile",
  "UI/UX Design",
  "Machine Learning",
  "Cloud Architecture",
];

export const RESUME_VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Visible to all Quorum members" },
  { value: "TEAM_LEADS", label: "Visible only to team leads during applications" },
  { value: "PROJECT_OWNERS", label: "Visible only to project sponsors" },
  { value: "PROJECT_OWNERS_AND_PROFESSORS", label: "Visible to project sponsors and professors" },
  { value: "PRIVATE", label: "Keep private" },
];
