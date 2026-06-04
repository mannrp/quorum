export type TeamRole = "LEAD" | "CO_LEAD" | "MEMBER";
export type ProjectStatus = "OPEN" | "IN_REVIEW" | "CLAIMED" | "CLOSED";
export type TeamRecruitingState = "RECRUITING" | "PAUSED" | "FULL" | "HIDDEN";
export type TeamCapstoneState = "FORMING" | "APPLYING" | "OFFER_RECEIVED" | "MATCHED" | "CLOSED";
export type TeamVisibility = "VISIBLE" | "HIDDEN";
export type ProjectLifecycleState = "DRAFT" | "OPEN" | "REVIEWING" | "OFFER_SENT" | "MATCHED" | "CLOSED" | "ARCHIVED";
export type ProjectApprovalState = "UNVERIFIED" | "SUBMITTED_FOR_APPROVAL" | "PROFESSOR_APPROVED" | "CHANGES_REQUESTED";
export type ApplicationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MESSAGE_SENT"
  | "OFFER_SENT"
  | "TEAM_CONFIRMED"
  | "OWNER_CONFIRMED"
  | "MATCHED"
  | "WITHDRAWN"
  | "EXPIRED";
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
  userIntent?: string;
  resumeVisibility?: string;
  discord?: string | null;
  availabilityNote?: string | null;
  preferredProjectAreas?: string[];
  profileComplete?: boolean;
  deactivatedAt?: string | null;
  archivedAt?: string | null;
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
  recruitingState?: TeamRecruitingState;
  capstoneState?: TeamCapstoneState;
  visibility?: TeamVisibility;
  discordLink?: string | null;
  existingSkills?: string[];
  neededSkills?: string[];
  projectInterests?: string[];
  archivedAt?: string | null;
  permissions?: {
    canEdit: boolean;
    canManageMembers: boolean;
    canInviteMembers: boolean;
    canArchive: boolean;
    canApplyToProjects: boolean;
  };
  createdBy: User;
  members: TeamMembership[];
  project?: Project | null;
  createdAt?: string;
};

export type ProjectApplication = {
  id: string;
  project?: Project;
  team: Team;
  applicant?: User | null;
  message?: string | null;
  answers?: string;
  status: ApplicationStatus;
  reviewMessage?: string | null;
  offerMessage?: string | null;
  teamConfirmedAt?: string | null;
  ownerConfirmedAt?: string | null;
  expiresAt?: string | null;
  withdrawnAt?: string | null;
  createdAt: string;
};

export type Project = {
  id: string;
  title: string;
  summary?: string;
  description: string;
  constraints?: string | null;
  disciplines: string[];
  teamSizeMin: number;
  teamSizeMax: number;
  status: ProjectStatus;
  lifecycleState?: ProjectLifecycleState;
  approvalState?: ProjectApprovalState;
  requiredSkills?: string[];
  niceToHaveSkills?: string[];
  deliverables?: string | null;
  timeline?: string | null;
  evaluationCriteria?: string | null;
  externalResources?: string[];
  ownerContactPreference?: string | null;
  applicationQuestions?: string;
  archivedAt?: string | null;
  permissions?: {
    canEdit: boolean;
    canReviewApplications: boolean;
    canSubmitForApproval: boolean;
    canApprove: boolean;
    canArchive: boolean;
  };
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
