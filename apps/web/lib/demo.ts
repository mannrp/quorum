export type DemoPersona = "student" | "owner" | "admin";

export const DEMO_COOKIE_NAME = "quorum_demo_persona";
export const DEMO_PERSONAS: {
  id: DemoPersona;
  label: string;
  role: string;
  description: string;
  startPath: string;
}[] = [
  {
    id: "student",
    label: "Student Lead",
    role: "Nadia Brooks",
    description: "Team leadership, applications, offers, invitations, messages, and notifications.",
    startPath: "/dashboard",
  },
  {
    id: "owner",
    label: "Project Owner",
    role: "Marcus Chen",
    description: "Project creation, approval submission, applicant review, offers, and sponsor messaging.",
    startPath: "/dashboard",
  },
  {
    id: "admin",
    label: "Admin Professor",
    role: "Dr. Elaine Roy",
    description: "Approval review, deadlines, audit logs, marketplace moderation, and demo reset.",
    startPath: "/admin",
  },
];

export function demoModeEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
}

export function demoResetEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_RESET_ENABLED === "true";
}

export function isDemoPersona(value: string | undefined | null): value is DemoPersona {
  return value === "student" || value === "owner" || value === "admin";
}

export function demoPersonaFromAuthUserId(authUserId: string | undefined | null): DemoPersona | null {
  switch (authUserId) {
    case "demo_student_lead":
      return "student";
    case "demo_project_owner":
      return "owner";
    case "demo_admin_professor":
      return "admin";
    default:
      return null;
  }
}
