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
    default:
      throw new Error("Operation is not registered.");
  }
}
