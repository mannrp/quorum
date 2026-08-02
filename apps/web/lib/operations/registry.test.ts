// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveOperation } from "./registry";

describe("registered browser operations", () => {
  it("resolves PublicHomeV1 to a server-owned anonymous document", () => {
    const operation = resolveOperation("PublicHomeV1", {});
    expect(operation.auth).toBe("anonymous");
    expect(operation.variables).toEqual({});
    expect(operation.document).toContain("query PublicHomeV1");
    expect(operation.document).not.toContain("fileUrl");
  });

  it("resolves shell counts only as an authenticated no-input operation", () => {
    const operation = resolveOperation("ShellCountsV1", {});
    expect(operation.auth).toBe("authenticated");
    expect(operation.variables).toEqual({});
    expect(operation.document).toContain("query ShellCountsV1");
    expect(operation.document).not.toMatch(/isAdmin|role|email|userId/);
  });
  it.each([
    ["ViewerProfileV1", {}, "query ViewerProfileV1"],
    ["DashboardV1", {}, "query DashboardV1"],
    ["DeactivateAccountV1", {}, "mutation DeactivateAccountV1"],
    ["DeactivateAccountV1", { reason: "No longer needed" }, "mutation DeactivateAccountV1"],
    ["UpdateMyProfileV1", {
      input: {
        username: "current-user",
        fullName: "Current User",
        bio: "Builder",
        discipline: "SOEN",
        university: "Concordia",
        linkedinUrl: "https://linkedin.example/current",
        githubUrl: "",
        portfolioUrl: "https://example.test",
        resumeVisibility: "PRIVATE",
        skills: ["Go", "TypeScript"],
      },
    }, "mutation UpdateMyProfileV1"],
  ])("resolves authenticated self-service operation %s", (id, variables, documentName) => {
    const operation = resolveOperation(id, variables);
    expect(operation.auth).toBe("authenticated");
    expect(operation.document).toContain(documentName);
    expect(operation.document).not.toMatch(/authUserId|resumeUrl|fileUrl|publicUrl/);
  });
  it.each([
    ["TeamManageV1", { teamId: "11111111-1111-4111-8111-111111111111" }, "query TeamManageV1"],
    ["CreateTeamV1", { input: { name: "Aegis", description: "Team", discipline: "SOEN", maxSize: 12, visibility: "VISIBLE", existingSkills: [], neededSkills: [] } }, "mutation CreateTeamV1"],
    ["RequestTeamJoinV1", { teamId: "11111111-1111-4111-8111-111111111111", message: "Please let me join." }, "mutation RequestTeamJoinV1"],
    ["RespondTeamInvitationV1", { invitationId: "11111111-1111-4111-8111-111111111111", accept: true }, "mutation RespondTeamInvitationV1"],
  ])("resolves bounded authenticated Team operation %s", (id, variables, documentName) => {
    const operation = resolveOperation(id, variables);
    expect(operation.auth).toBe("authenticated");
    expect(operation.document).toContain(documentName);
    expect(operation.document).not.toMatch(/authUserId|email|resumeUrl|fileUrl|publicUrl/);
  });  it.each([
    ["ProjectSessionV1", {}, "query ProjectSessionV1"],
    ["CreateProjectV1", { input: { title: "Challenge", summary: "Summary", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, lifecycleState: "OPEN", approvalState: "UNVERIFIED" } }, "mutation CreateProjectV1"],
    ["ApplyToProjectV1", { input: { projectId: "11111111-1111-4111-8111-111111111111", teamId: "22222222-2222-4222-8222-222222222222", message: "Application" } }, "mutation ApplyToProjectV1"],
    ["SendProjectOfferV1", { applicationId: "11111111-1111-4111-8111-111111111111", message: "Offer" }, "mutation SendProjectOfferV1"],
    ["UpdateProjectV1", { projectId: "11111111-1111-4111-8111-111111111111", input: { title: "Challenge", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, lifecycleState: "REVIEWING", approvalState: "CHANGES_REQUESTED" } }, "mutation UpdateProjectV1"],
  ])("resolves bounded authenticated Project operation %s", (id, variables, documentName) => {
    const operation = resolveOperation(id, variables);
    expect(operation.auth).toBe("authenticated");
    expect(operation.document).toContain(documentName);
    expect(operation.document).not.toMatch(/authUserId|email|resumeUrl|fileUrl|publicUrl/);
  });  it.each([
    ["PublicTeamsV1", {}, "query PublicTeamsV1"],
    ["PublicTeamsV1", { search: "robotics" }, "query PublicTeamsV1"],
    ["PublicProjectsV1", {}, "query PublicProjectsV1"],
    ["PublicProjectsV1", { search: "health" }, "query PublicProjectsV1"],
    ["PublicTeamV1", { id: "11111111-1111-4111-8111-111111111111" }, "query PublicTeamV1"],
    ["PublicProjectV1", { id: "22222222-2222-4222-8222-222222222222" }, "query PublicProjectV1"],
    ["PublicProfileV1", { username: "safe-user" }, "query PublicProfileV1"],
  ])("resolves %s with validated public variables", (id, variables, documentName) => {
    const operation = resolveOperation(id, variables);
    expect(operation.auth).toBe(id === "PublicTeamV1" || id === "PublicProjectV1" ? "optional" : "anonymous");
    expect(operation.variables).toEqual(variables);
    expect(operation.document).toContain(documentName);
    expect(operation.document).not.toMatch(/authUserId|email|permissions|applications|fileUrl|resumeUrl|discordLink/);
  });

  it.each([
    ["Unknown", {}],
    ["PublicHomeV1", { query: "{ users { email } }" }],
    ["PublicHomeV1", { userId: "forged" }],
    ["PublicTeamsV1", { search: "x".repeat(101) }],
    ["PublicTeamsV1", { search: "ok", role: "ADMIN" }],
    ["PublicProjectV1", { id: "not-a-uuid" }],
    ["PublicProfileV1", { username: "../admin" }],
    ["ShellCountsV1", { userId: "forged" }],
    ["ViewerProfileV1", { userId: "forged" }],
    ["DashboardV1", { role: "ADMIN" }],
    ["DeactivateAccountV1", { reason: "x".repeat(501) }],
    ["UpdateMyProfileV1", { input: { username: "current-user", fullName: "Name", email: "forged@example.test" } }],
    ["UpdateMyProfileV1", { input: { username: "current-user", fullName: "Name", resumeUrl: "https://public.example/file" } }],
    ["UpdateMyProfileV1", { input: { username: "current-user", fullName: "Name", linkedinUrl: "javascript:alert(1)" } }],
    ["TeamManageV1", { teamId: "not-a-uuid" }],
    ["CreateTeamV1", { input: { name: "Aegis", description: "Team", discipline: "SOEN", maxSize: 4, isComplete: false, visibility: "VISIBLE", existingSkills: [], neededSkills: [] } }],
    ["CreateTeamV1", { input: { name: "Aegis", description: "Team", discipline: "SOEN", maxSize: 12, discordLink: "javascript:alert(1)", visibility: "VISIBLE", existingSkills: [], neededSkills: [] } }],
    ["RequestTeamJoinV1", { teamId: "11111111-1111-4111-8111-111111111111", message: "x".repeat(1001) }],
    ["RespondTeamInvitationV1", { invitationId: "11111111-1111-4111-8111-111111111111", accept: "yes" }],
    ["CreateProjectV1", { input: { title: "Challenge", summary: "Summary", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, lifecycleState: "OPEN", approvalState: "UNVERIFIED", fileUrl: "https://public.example/file" } }],
    ["CreateProjectV1", { input: { title: "Challenge", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, videoUrl: "data:text/html,unsafe" } }],
    ["CreateProjectV1", { input: { title: "Challenge", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, externalResources: ["javascript:alert(1)"] } }],
    ["ApplyToProjectV1", { input: { projectId: "not-a-uuid", teamId: "22222222-2222-4222-8222-222222222222" } }],
    ["SendProjectOfferV1", { applicationId: "11111111-1111-4111-8111-111111111111", message: "x".repeat(1001) }],
    ["UpdateProjectV1", { projectId: "11111111-1111-4111-8111-111111111111", input: { title: "Challenge", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, lifecycleState: "CLAIMED" } }],
    ["UpdateProjectV1", { projectId: "11111111-1111-4111-8111-111111111111", input: { title: "Challenge", description: "Full description", disciplines: ["SOEN"], teamSizeMin: 10, teamSizeMax: 12, approvalState: "PROFESSOR_REJECTED" } }],
  ])("rejects unregistered or expanded input for %s", (id, variables) => {
    expect(() => resolveOperation(id, variables)).toThrow();
  });
});