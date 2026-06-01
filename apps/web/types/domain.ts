export type TeamRole = "LEAD" | "CO_LEAD" | "MEMBER";
export type ProjectStatus = "OPEN" | "IN_REVIEW" | "CLAIMED" | "CLOSED";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type UploadAssetKind = "RESUME" | "PROJECT_FILE" | "AVATAR" | "VIDEO";

export type Tag = { id: string; name: string; isPredefined: boolean };

export type User = {
  id: string;
  authUserId?: string;
  username: string;
  email?: string | null;
  fullName: string;
  bio?: string | null;
  discipline?: string | null;
  university?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  resumeUrl?: string | null;
  avatarUrl?: string | null;
  tags?: Tag[];
  createdAt?: string;
};

export type TeamMembership = {
  id: string;
  user: User;
  team?: Team;
  role: TeamRole;
  joinedAt: string;
};

export type Team = {
  id: string;
  name: string;
  description?: string | null;
  isComplete: boolean;
  maxSize: number;
  discipline?: string | null;
  createdBy: User;
  members: TeamMembership[];
  project?: Project | null;
  createdAt?: string;
};

export type ProjectApplication = {
  id: string;
  project?: Project;
  team: Team;
  message?: string | null;
  status: ApplicationStatus;
  createdAt: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  constraints?: string | null;
  disciplines: string[];
  teamSizeMin: number;
  teamSizeMax: number;
  status: ProjectStatus;
  owner: User;
  team?: Team | null;
  fileUrl?: string | null;
  videoUrl?: string | null;
  applications: ProjectApplication[];
  createdAt?: string;
};

export type Message = {
  id: string;
  sender: User;
  receiver: User;
  body: string;
  read: boolean;
  createdAt: string;
};

export type Notification = {
  id: string;
  type: string;
  payload: string;
  read: boolean;
  createdAt: string;
};

export type UploadSignature = {
  url: string;
  key: string;
  publicUrl?: string | null;
  expiresAt: string;
  fields: { name: string; value: string }[];
};
