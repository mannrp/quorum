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
  TeamManageV1: `query TeamManageV1($teamId: ID!) {
    team(id: $teamId) { ${publicTeamFields} }
    teamJoinRequests(teamId: $teamId, status: PENDING) {
      id message status createdAt user { id fullName username discipline }
    }
  }`,
  CreateTeamV1: `mutation CreateTeamV1($input: CreateTeamInput!) { createTeam(input: $input) { id } }`,
  UpdateTeamV1: `mutation UpdateTeamV1($teamId: ID!, $input: UpdateTeamInput!) { updateTeam(id: $teamId, input: $input) { id } }`,
  RequestTeamJoinV1: `mutation RequestTeamJoinV1($teamId: ID!, $message: String) { requestJoin(teamId: $teamId, message: $message) { id status } }`,
  RespondTeamJoinV1: `mutation RespondTeamJoinV1($requestId: ID!, $accept: Boolean!) { respondToJoinRequest(requestId: $requestId, accept: $accept) { id status } }`,
  ConfirmTeamJoinV1: `mutation ConfirmTeamJoinV1($requestId: ID!) { confirmJoinRequest(requestId: $requestId) { id status } }`,
  SearchTeamInviteesV1: `query SearchTeamInviteesV1($search: String!) { users(search: $search) { id fullName username } }`,
  InviteTeamMemberV1: `mutation InviteTeamMemberV1($teamId: ID!, $userId: ID!, $message: String) { inviteTeamMember(teamId: $teamId, userId: $userId, message: $message) { id status expiresAt } }`,
  RespondTeamInvitationV1: `mutation RespondTeamInvitationV1($invitationId: ID!, $accept: Boolean!) { respondToTeamInvitation(invitationId: $invitationId, accept: $accept) { id status } }`,
  RemoveTeamMemberV1: `mutation RemoveTeamMemberV1($teamId: ID!, $userId: ID!) { removeMember(teamId: $teamId, userId: $userId) }`,
  PromoteTeamMemberV1: `mutation PromoteTeamMemberV1($teamId: ID!, $userId: ID!, $role: TeamRole!) { promoteMember(teamId: $teamId, userId: $userId, role: $role) { id role } }`,
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
function uuidValue(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Operation variables are invalid.");
  }
  return value;
}

function namedIDVariables(value: unknown, keys: readonly string[]): Record<string, string> {
  const variables = record(value);
  exactKeys(variables, keys);
  const parsed: Record<string, string> = {};
  for (const key of keys) parsed[key] = uuidValue(variables[key]);
  return parsed;
}

function decisionVariables(value: unknown, idKey: string): Record<string, string | boolean> {
  const variables = record(value);
  exactKeys(variables, [idKey, "accept"]);
  if (typeof variables.accept !== "boolean") throw new Error("Operation variables are invalid.");
  return { [idKey]: uuidValue(variables[idKey]), accept: variables.accept };
}

function messageVariables(value: unknown, idKey: string): Record<string, string> {
  const variables = record(value);
  exactKeys(variables, [idKey, "message"]);
  const parsed: Record<string, string> = { [idKey]: uuidValue(variables[idKey]) };
  if (variables.message !== undefined) {
    if (typeof variables.message !== "string" || variables.message.trim().length > 1_000) throw new Error("Operation variables are invalid.");
    const message = variables.message.trim();
    if (message) parsed.message = message;
  }
  return parsed;
}

function teamInput(value: unknown, updating: boolean): Record<string, unknown> {
  const input = record(value);
  const allowed = ["name", "description", "discipline", "maxSize", "isComplete", "recruitingState", "visibility", "discordLink", "existingSkills", "neededSkills", "projectInterests"];
  exactKeys(input, allowed);
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) throw new Error("Operation variables are invalid.");
  if (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 4_000)) throw new Error("Operation variables are invalid.");
  if (input.discipline !== undefined && (typeof input.discipline !== "string" || input.discipline.length > 120)) throw new Error("Operation variables are invalid.");
  if (input.maxSize !== 12) throw new Error("Operation variables are invalid.");
  if (updating && typeof input.isComplete !== "boolean") throw new Error("Operation variables are invalid.");
  if (!updating && input.isComplete !== undefined) throw new Error("Operation variables are invalid.");
  if (input.recruitingState !== undefined && !["RECRUITING", "PAUSED"].includes(input.recruitingState as string)) throw new Error("Operation variables are invalid.");
  if (input.visibility !== undefined && !["VISIBLE", "HIDDEN"].includes(input.visibility as string)) throw new Error("Operation variables are invalid.");
  if (input.discordLink !== undefined && input.discordLink !== null && (typeof input.discordLink !== "string" || input.discordLink.length > 2_048)) throw new Error("Operation variables are invalid.");
  for (const key of ["existingSkills", "neededSkills", "projectInterests"] as const) {
    const items = input[key];
    if (items !== undefined && (!Array.isArray(items) || items.length > 50 || !items.every((item) => typeof item === "string" && item.length > 0 && item.length <= 100))) throw new Error("Operation variables are invalid.");
  }
  return input;
}

function teamInputVariables(value: unknown, updating: boolean): Record<string, unknown> {
  const variables = record(value);
  exactKeys(variables, updating ? ["teamId", "input"] : ["input"]);
  const input = teamInput(variables.input, updating);
  return updating ? { teamId: uuidValue(variables.teamId), input } : { input };
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
    case "TeamManageV1":
      return { auth: "authenticated", document: documents.TeamManageV1, variables: namedIDVariables(variables, ["teamId"]) };
    case "CreateTeamV1":
      return { auth: "authenticated", document: documents.CreateTeamV1, variables: teamInputVariables(variables, false) };
    case "UpdateTeamV1":
      return { auth: "authenticated", document: documents.UpdateTeamV1, variables: teamInputVariables(variables, true) };
    case "RequestTeamJoinV1":
      return { auth: "authenticated", document: documents.RequestTeamJoinV1, variables: messageVariables(variables, "teamId") };
    case "RespondTeamJoinV1":
      return { auth: "authenticated", document: documents.RespondTeamJoinV1, variables: decisionVariables(variables, "requestId") };
    case "ConfirmTeamJoinV1":
      return { auth: "authenticated", document: documents.ConfirmTeamJoinV1, variables: namedIDVariables(variables, ["requestId"]) };
    case "SearchTeamInviteesV1":
      return { auth: "authenticated", document: documents.SearchTeamInviteesV1, variables: searchVariables(variables) };
    case "InviteTeamMemberV1": {
      const parsed = messageVariables(variables, "teamId");
      const source = record(variables);
      exactKeys(source, ["teamId", "userId", "message"]);
      return { auth: "authenticated", document: documents.InviteTeamMemberV1, variables: { ...parsed, userId: uuidValue(source.userId) } };
    }
    case "RespondTeamInvitationV1":
      return { auth: "authenticated", document: documents.RespondTeamInvitationV1, variables: decisionVariables(variables, "invitationId") };
    case "RemoveTeamMemberV1":
      return { auth: "authenticated", document: documents.RemoveTeamMemberV1, variables: namedIDVariables(variables, ["teamId", "userId"]) };
    case "PromoteTeamMemberV1": {
      const source = record(variables);
      exactKeys(source, ["teamId", "userId", "role"]);
      if (source.role !== "MEMBER" && source.role !== "CO_LEAD") throw new Error("Operation variables are invalid.");
      return { auth: "authenticated", document: documents.PromoteTeamMemberV1, variables: { teamId: uuidValue(source.teamId), userId: uuidValue(source.userId), role: source.role } };
    }
    default:
      throw new Error("Operation is not registered.");
  }
}
