import "server-only";

type RegisteredOperation = Readonly<{
  auth: "anonymous" | "authenticated";
  document: string;
  variables: Record<string, unknown>;
}>;

const publicHomeDocument = `
  query PublicHomeV1 {
    projects {
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
    }
  }
`;

export function resolveOperation(id: string, variables: unknown): RegisteredOperation {
  if (id !== "PublicHomeV1") throw new Error("Operation is not registered.");
  if (!variables || typeof variables !== "object" || Array.isArray(variables) || Object.keys(variables).length !== 0) {
    throw new Error("Operation variables are invalid.");
  }
  return { auth: "anonymous", document: publicHomeDocument, variables: {} };
}