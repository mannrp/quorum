import "server-only";

type RegisteredOperation = Readonly<{
  auth: "anonymous" | "authenticated";
  document: string;
  variables: Record<string, unknown>;
}>;

const projectListFields = `
  id
  title
  summary
  description
  disciplines
  teamSizeMin
  teamSizeMax
  status
  lifecycleState
  approvalState
`;

const publicUserFields = `
  id
  username
  fullName
  bio
  discipline
  university
  linkedinUrl
  githubUrl
  portfolioUrl
  avatarUrl
  tags { id name isPredefined }
`;

const publicTeamFields = `
  id
  name
  description
  isComplete
  maxSize
  discipline
  recruitingState
  capstoneState
  visibility
  existingSkills
  neededSkills
  projectInterests
  createdBy { id username fullName discipline }
  members { id role joinedAt user { id username fullName discipline } }
  project { id title summary description status lifecycleState }
`;

const publicProjectFields = `
  ${projectListFields}
  constraints
  requiredSkills
  niceToHaveSkills
  deliverables
  timeline
  evaluationCriteria
  externalResources
  applicationQuestions
  owner { id username fullName discipline }
  team { id name isComplete maxSize discipline }
`;

const documents = {
  PublicHomeV1: `query PublicHomeV1 { projects { ${projectListFields} } }`,
  PublicTeamsV1: `query PublicTeamsV1($search: String) { teams(search: $search) { ${publicTeamFields} } }`,
  PublicTeamV1: `query PublicTeamV1($id: ID!) { team(id: $id) { ${publicTeamFields} } }`,
  PublicProjectsV1: `query PublicProjectsV1($search: String) { projects(search: $search) { ${projectListFields} } }`,
  PublicProjectV1: `query PublicProjectV1($id: ID!) { project(id: $id) { ${publicProjectFields} } }`,
  PublicProfileV1: `query PublicProfileV1($username: String!) { user(username: $username) { ${publicUserFields} } }`,
  ShellCountsV1: `query ShellCountsV1 { dashboardContext { unreadMessages unreadNotifications } }`,
  ViewerProfileV1: `query ViewerProfileV1 {
    me {
      id username email fullName bio discipline university linkedinUrl githubUrl portfolioUrl
      userIntent resumeVisibility discord availabilityNote preferredProjectAreas profileComplete
      tags { id name isPredefined }
    }
  }`,
  UpdateMyProfileV1: `mutation UpdateMyProfileV1($input: UpsertMyProfileInput!) {
    upsertMyProfile(input: $input) { id }
  }`,
  DeactivateAccountV1: `mutation DeactivateAccountV1($reason: String) { deactivateAccount(reason: $reason) }`,
  DashboardV1: `query DashboardV1 {
    me { id username fullName userIntent }
    dashboardContext {
      myTeams {
        id name description isComplete maxSize
        members { id role user { id fullName } }
      }
      myProjects {
        id title description status
        applications { id status }
      }
      myInvitations {
        id status message expiresAt createdAt
        team { id name createdBy { id username fullName } }
        invitedBy { id username fullName }
      }
      universalDeadline { id deadlineAt updatedAt }
    }
    myNotifications { id type read createdAt }
    myJoinRequests(status: ACCEPTED_PENDING_CONFIRMATION) {
      id status message expiresAt createdAt team { id name }
    }
  }`,
} as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Operation variables are invalid.");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Operation variables are invalid.");
}

function noVariables(value: unknown): Record<string, never> {
  const variables = record(value);
  exactKeys(variables, []);
  return {};
}

function searchVariables(value: unknown): { search?: string } {
  const variables = record(value);
  exactKeys(variables, ["search"]);
  if (variables.search === undefined) return {};
  if (typeof variables.search !== "string") throw new Error("Operation variables are invalid.");
  const search = variables.search.trim();
  if (!search || search.length > 100) throw new Error("Operation variables are invalid.");
  return { search };
}

function optionalString(
  source: Record<string, unknown>,
  key: string,
  maximum: number,
  output: Record<string, unknown>,
): void {
  const value = source[key];
  if (value === undefined) return;
  if (typeof value !== "string" || value.length > maximum) throw new Error("Operation variables are invalid.");
  output[key] = value;
}

function deactivationVariables(value: unknown): { reason?: string } {
  const variables = record(value);
  exactKeys(variables, ["reason"]);
  if (variables.reason === undefined) return {};
  if (typeof variables.reason !== "string" || variables.reason.trim().length > 500) {
    throw new Error("Operation variables are invalid.");
  }
  const reason = variables.reason.trim();
  return reason ? { reason } : {};
}

function profileVariables(value: unknown): { input: Record<string, unknown> } {
  const variables = record(value);
  exactKeys(variables, ["input"]);
  const input = record(variables.input);
  const allowed = [
    "username", "fullName", "bio", "discipline", "university", "linkedinUrl", "githubUrl",
    "portfolioUrl", "userIntent", "resumeVisibility", "discord", "availabilityNote",
    "preferredProjectAreas", "skills", "tags",
  ];
  exactKeys(input, allowed);
  if (typeof input.username !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(input.username)) {
    throw new Error("Operation variables are invalid.");
  }
  if (typeof input.fullName !== "string" || !input.fullName.trim() || input.fullName.length > 120) {
    throw new Error("Operation variables are invalid.");
  }
  const parsed: Record<string, unknown> = { username: input.username, fullName: input.fullName.trim() };
  for (const [key, maximum] of [
    ["bio", 2_000], ["discipline", 120], ["university", 120], ["linkedinUrl", 2_048],
    ["githubUrl", 2_048], ["portfolioUrl", 2_048], ["userIntent", 32], ["discord", 120],
    ["availabilityNote", 500],
  ] as const) optionalString(input, key, maximum, parsed);
  if (input.resumeVisibility !== undefined) {
    const accepted = ["PRIVATE", "TEAM_LEADS", "PROJECT_OWNERS", "PROJECT_OWNERS_AND_PROFESSORS", "PUBLIC"];
    if (typeof input.resumeVisibility !== "string" || !accepted.includes(input.resumeVisibility)) {
      throw new Error("Operation variables are invalid.");
    }
    parsed.resumeVisibility = input.resumeVisibility;
  }
  for (const key of ["preferredProjectAreas", "skills", "tags"] as const) {
    const values = input[key];
    if (values === undefined) continue;
    if (!Array.isArray(values) || values.length > 50 || !values.every((item) => typeof item === "string" && item.length > 0 && item.length <= 100)) {
      throw new Error("Operation variables are invalid.");
    }
    parsed[key] = values;
  }
  return { input: parsed };
}
function idVariables(value: unknown): { id: string } {
  const variables = record(value);
  exactKeys(variables, ["id"]);
  if (typeof variables.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(variables.id)) {
    throw new Error("Operation variables are invalid.");
  }
  return { id: variables.id };
}

function usernameVariables(value: unknown): { username: string } {
  const variables = record(value);
  exactKeys(variables, ["username"]);
  if (typeof variables.username !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(variables.username)) {
    throw new Error("Operation variables are invalid.");
  }
  return { username: variables.username };
}

export function resolveOperation(id: string, variables: unknown): RegisteredOperation {
  switch (id) {
    case "PublicHomeV1":
      return { auth: "anonymous", document: documents.PublicHomeV1, variables: noVariables(variables) };
    case "PublicTeamsV1":
      return { auth: "anonymous", document: documents.PublicTeamsV1, variables: searchVariables(variables) };
    case "PublicTeamV1":
      return { auth: "anonymous", document: documents.PublicTeamV1, variables: idVariables(variables) };
    case "PublicProjectsV1":
      return { auth: "anonymous", document: documents.PublicProjectsV1, variables: searchVariables(variables) };
    case "PublicProjectV1":
      return { auth: "anonymous", document: documents.PublicProjectV1, variables: idVariables(variables) };
    case "PublicProfileV1":
      return { auth: "anonymous", document: documents.PublicProfileV1, variables: usernameVariables(variables) };
    case "ShellCountsV1":
      return { auth: "authenticated", document: documents.ShellCountsV1, variables: noVariables(variables) };
    case "ViewerProfileV1":
      return { auth: "authenticated", document: documents.ViewerProfileV1, variables: noVariables(variables) };
    case "UpdateMyProfileV1":
      return { auth: "authenticated", document: documents.UpdateMyProfileV1, variables: profileVariables(variables) };
    case "DeactivateAccountV1":
      return { auth: "authenticated", document: documents.DeactivateAccountV1, variables: deactivationVariables(variables) };
    case "DashboardV1":
      return { auth: "authenticated", document: documents.DashboardV1, variables: noVariables(variables) };
    default:
      throw new Error("Operation is not registered.");
  }
}
