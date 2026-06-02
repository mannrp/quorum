"use client";

import { useCallback, useEffect, useState } from "react";

export const AUTH_TOKEN_KEY = "quorum.neonAuthToken";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  const trimmed = token.trim();
  if (trimmed) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, trimmed);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

// --- Client-Side Mock Database Implementation ---
const MOCK_DB_KEY = "quorum.mockDb";

type MockDbSchema = {
  users: any[];
  teams: any[];
  projects: any[];
  messages: any[];
  notifications: any[];
  auditLogs: any[];
  universalDeadline: string;
};

const DEFAULT_DB: MockDbSchema = {
  users: [
    {
      id: "user-student-1",
      username: "janedoe",
      fullName: "Jane Doe",
      email: "jane@concordia.ca",
      bio: "Software engineering student interested in cybersecurity and Web3.",
      discipline: "SOEN",
      university: "Concordia",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      githubUrl: "https://github.com/janedoe",
      portfolioUrl: "https://janedoe.dev",
      resumeUrl: "https://quorum.s3.amazonaws.com/resumes/jane_resume.pdf",
      avatarUrl: "",
      tags: [
        { id: "tag-typescript", name: "TypeScript", isPredefined: true },
        { id: "tag-react", name: "React", isPredefined: true },
        { id: "tag-nextjs", name: "Next.js", isPredefined: true }
      ]
    },
    {
      id: "user-student-2",
      username: "marcusv",
      fullName: "Marcus Vance",
      email: "marcus@concordia.ca",
      bio: "Computer engineering student specializing in hardware security and microcontrollers.",
      discipline: "COEN",
      university: "Concordia",
      linkedinUrl: "https://linkedin.com/in/marcusv",
      githubUrl: "https://github.com/marcusv",
      tags: [
        { id: "tag-c", name: "C++", isPredefined: true },
        { id: "tag-embedded", name: "Embedded Systems", isPredefined: true },
        { id: "tag-robotics", name: "Robotics", isPredefined: true }
      ]
    },
    {
      id: "user-prof-smith",
      username: "profsmith",
      fullName: "Dr. Arthur Smith",
      email: "smith@concordia.ca",
      bio: "Professor in Software Engineering and Capstone Director.",
      discipline: "SOEN",
      university: "Concordia",
      tags: []
    },
    {
      id: "user-sponsor-sam",
      username: "sponsorsam",
      fullName: "Sponsor Sam",
      email: "sam@securitysandbox.com",
      bio: "Industry sponsor focusing on container orchestration and cloud security.",
      discipline: "SOEN",
      university: "Concordia",
      tags: []
    }
  ],
  teams: [
    {
      id: "team-robotics",
      name: "Distributed Robotics Swarm",
      description: "Building autonomous drone swarm coordination protocols using ROS2.",
      isComplete: false,
      maxSize: 4,
      discipline: "COEN",
      createdBy: { id: "user-student-2", username: "marcusv", fullName: "Marcus Vance", discipline: "COEN" },
      members: [
        {
          id: "mem-marcus",
          role: "LEAD",
          joinedAt: new Date().toISOString(),
          user: { id: "user-student-2", username: "marcusv", fullName: "Marcus Vance", discipline: "COEN" }
        }
      ],
      project: null,
      createdAt: new Date().toISOString()
    }
  ],
  projects: [
    {
      id: "proj-security",
      title: "Automated Container Scanning Sandbox",
      description: "Evaluate automated security scanners (Snyk, Trivy, Grype) on live Kubernetes clusters and report metrics.",
      constraints: "Requires AWS or GCP sandbox environment.",
      disciplines: ["SOEN", "COEN"],
      teamSizeMin: 3,
      teamSizeMax: 4,
      status: "OPEN",
      fileUrl: "https://quorum.s3.amazonaws.com/projects/spec_v1.pdf",
      videoUrl: "https://youtube.com/watch?v=mock-spec",
      createdAt: new Date().toISOString(),
      owner: { id: "user-sponsor-sam", username: "sponsorsam", fullName: "Sponsor Sam", discipline: "SOEN" },
      applications: []
    }
  ],
  messages: [
    {
      id: "msg-1",
      body: "Hi Marcus, are you planning to apply for the Container Scanning project?",
      read: true,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      sender: { id: "user-sponsor-sam", username: "sponsorsam", fullName: "Sponsor Sam" },
      receiver: { id: "user-student-2", username: "marcusv", fullName: "Marcus Vance" }
    },
    {
      id: "msg-2",
      body: "Yes Sam! We are currently assembling our COEN team and will apply soon.",
      read: true,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      sender: { id: "user-student-2", username: "marcusv", fullName: "Marcus Vance" },
      receiver: { id: "user-sponsor-sam", username: "sponsorsam", fullName: "Sponsor Sam" }
    }
  ],
  notifications: [
    {
      id: "notif-1",
      type: "TEAM_INVITE",
      payload: JSON.stringify({ teamId: "team-robotics", teamName: "Distributed Robotics Swarm", inviterName: "Marcus Vance" }),
      read: false,
      createdAt: new Date().toISOString()
    }
  ],
  auditLogs: [
    { id: "log-1", action: "System Bootstrapped", reason: "Initialized client sandbox database", createdAt: new Date().toISOString() }
  ],
  universalDeadline: "2026-06-20T23:59:59.000Z"
};

function getMockDb(): MockDbSchema {
  if (typeof window === "undefined") return DEFAULT_DB;
  const raw = window.localStorage.getItem(MOCK_DB_KEY);
  if (!raw) {
    window.localStorage.setItem(MOCK_DB_KEY, JSON.stringify(DEFAULT_DB));
    return DEFAULT_DB;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DB;
  }
}

function saveMockDb(db: MockDbSchema) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
}

// Get user from token
function getAuthenticatedUser(token: string, db: MockDbSchema) {
  if (!token) return null;
  try {
    const parsed = JSON.parse(atob(token));
    if (parsed && parsed.email) {
      return db.users.find(u => u.email.toLowerCase() === parsed.email.toLowerCase()) || null;
    }
  } catch {}
  return db.users[0]; // fallback
}

export async function graphqlRequest<T>(query: string, variables?: Record<string, any>, token = getAuthToken()): Promise<T> {
  const db = getMockDb();
  const currentUser = getAuthenticatedUser(token, db);

  // Normalize query string to identify operation
  const normQuery = query.replace(/\s+/g, " ").trim();
  const isMutation = normQuery.startsWith("mutation");
  
  // Extract operation name
  const match = normQuery.match(/(?:query|mutation)\s+(\w+)/);
  const operationName = match ? match[1] : "";

  console.log(`[GraphQL Mock DB] Running ${isMutation ? "mutation" : "query"}: ${operationName}`, { variables, currentUser });

  // Delay simulation for premium loader aesthetic
  await new Promise(resolve => setTimeout(resolve, 300));

  const response: any = {};

  try {
    if (!isMutation) {
      // --- QUERY ROUTING ---
      switch (operationName) {
        case "Me": {
          response.me = currentUser || null;
          break;
        }
        case "Home":
        case "Teams": {
          response.teams = db.teams.filter(t => !t.archived);
          response.projects = db.projects.filter(p => !p.archived);
          break;
        }
        case "Team": {
          const id = variables?.id;
          const found = db.teams.find(t => t.id === id && !t.archived);
          response.team = found ? {
            ...found,
            members: found.members.map((m: any) => ({
              ...m,
              user: db.users.find(u => u.id === m.user.id) || m.user
            }))
          } : null;
          break;
        }
        case "Projects": {
          response.projects = db.projects.filter(p => !p.archived);
          break;
        }
        case "Project": {
          const id = variables?.id;
          const found = db.projects.find(p => p.id === id && !p.archived);
          if (found) {
            response.project = {
              ...found,
              applications: found.applications.map((app: any) => ({
                ...app,
                team: db.teams.find(t => t.id === app.team.id) || app.team
              }))
            };
          } else {
            response.project = null;
          }
          break;
        }
        case "Profile": {
          const username = variables?.username;
          response.user = db.users.find(u => u.username === username) || null;
          break;
        }
        case "Inbox": {
          response.me = currentUser || null;
          // Returns unique users this user has messages with
          const talkers = new Map<string, any>();
          if (currentUser) {
            db.messages.forEach(m => {
              if (m.sender.id === currentUser.id && m.receiver.id !== currentUser.id) {
                talkers.set(m.receiver.id, db.users.find(u => u.id === m.receiver.id));
              } else if (m.receiver.id === currentUser.id && m.sender.id !== currentUser.id) {
                talkers.set(m.sender.id, db.users.find(u => u.id === m.sender.id));
              }
            });
            // If inbox is completely empty, insert a conversation with Sam or Marcus as fallback for demonstration
            if (talkers.size === 0) {
              const partner = db.users.find(u => u.id !== currentUser.id);
              if (partner) talkers.set(partner.id, partner);
            }
          }
          response.myInbox = Array.from(talkers.values()).filter(Boolean);
          break;
        }
        case "Messages": {
          const withUser = variables?.withUser;
          if (currentUser && withUser) {
            response.myMessages = db.messages.filter(m => 
              (m.sender.id === currentUser.id && m.receiver.id === withUser) ||
              (m.sender.id === withUser && m.receiver.id === currentUser.id)
            ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          } else {
            response.myMessages = [];
          }
          break;
        }
        case "Notifications": {
          response.myNotifications = db.notifications;
          break;
        }
        case "Admin": {
          response.users = db.users;
          response.teams = db.teams;
          response.projects = db.projects;
          break;
        }
        default: {
          // General fallback values if query matches nothing specific
          response.me = currentUser;
          response.teams = db.teams;
          response.projects = db.projects;
        }
      }
    } else {
      // --- MUTATION ROUTING ---
      switch (operationName) {
        case "Bootstrap": {
          const input = variables?.input || {};
          const newUser = {
            id: `user-${Date.now()}`,
            username: input.username || "newuser",
            fullName: input.fullName || "Jane Doe",
            email: currentUser?.email || "new@concordia.ca",
            discipline: input.discipline || "SOEN",
            university: input.university || "Concordia",
            bio: input.bio || "",
            tags: [],
            createdAt: new Date().toISOString()
          };
          db.users.push(newUser);
          saveMockDb(db);
          response.bootstrapProfile = newUser;
          break;
        }
        case "UpdateSkills":
        case "UpdateProfile": {
          const input = variables?.input || {};
          if (currentUser) {
            const userIndex = db.users.findIndex(u => u.id === currentUser.id);
            if (userIndex !== -1) {
              db.users[userIndex] = {
                ...db.users[userIndex],
                ...input,
                tags: input.tags ? input.tags.map((t: any) => typeof t === "string" ? { id: t, name: t, isPredefined: false } : t) : db.users[userIndex].tags
              };
              saveMockDb(db);
              response.updateProfile = db.users[userIndex];
            }
          }
          break;
        }
        case "CreateTeam": {
          const input = variables?.input || {};
          if (currentUser) {
            const newTeam = {
              id: `team-${Date.now()}`,
              name: input.name,
              description: input.description,
              maxSize: input.maxSize || 4,
              discipline: input.discipline || currentUser.discipline,
              isComplete: false,
              createdBy: { id: currentUser.id, username: currentUser.username, fullName: currentUser.fullName },
              members: [
                {
                  id: `mem-${Date.now()}`,
                  role: "LEAD",
                  joinedAt: new Date().toISOString(),
                  user: { id: currentUser.id, username: currentUser.username, fullName: currentUser.fullName }
                }
              ],
              project: null,
              createdAt: new Date().toISOString()
            };
            db.teams.push(newTeam);
            saveMockDb(db);
            response.createTeam = newTeam;
          }
          break;
        }
        case "UpdateTeamDetails": {
          const id = variables?.id;
          const input = variables?.input || {};
          const teamIndex = db.teams.findIndex(t => t.id === id);
          if (teamIndex !== -1) {
            db.teams[teamIndex] = {
              ...db.teams[teamIndex],
              ...input
            };
            saveMockDb(db);
            response.updateTeam = db.teams[teamIndex];
          }
          break;
        }
        case "InviteUser": {
          const teamId = variables?.teamId;
          const userId = variables?.userId;
          const invitee = db.users.find(u => u.id === userId);
          const team = db.teams.find(t => t.id === teamId);
          if (invitee && team) {
            db.notifications.push({
              id: `notif-${Date.now()}`,
              type: "TEAM_INVITE",
              payload: JSON.stringify({ teamId, teamName: team.name, inviterName: currentUser?.fullName || "A Team Lead" }),
              read: false,
              createdAt: new Date().toISOString()
            });
            saveMockDb(db);
            response.inviteUserToTeam = { id: `invite-${Date.now()}` };
          }
          break;
        }
        case "RespondRequest": {
          const requestId = variables?.requestId; // actually matches join requests or notification IDs
          const status = variables?.status;
          // Find any relevant invite or request, update status, and simulate membership add
          if (status === "ACCEPTED" && currentUser) {
            // Find invite in notification and add user to team
            const notif = db.notifications.find(n => n.id === requestId);
            if (notif) {
              const payload = JSON.parse(notif.payload);
              const teamIndex = db.teams.findIndex(t => t.id === payload.teamId);
              if (teamIndex !== -1 && !db.teams[teamIndex].members.some((m: any) => m.user.id === currentUser.id)) {
                db.teams[teamIndex].members.push({
                  id: `mem-${Date.now()}`,
                  role: "MEMBER",
                  joinedAt: new Date().toISOString(),
                  user: { id: currentUser.id, username: currentUser.username, fullName: currentUser.fullName }
                });
                db.notifications = db.notifications.filter(n => n.id !== requestId);
                saveMockDb(db);
              }
            }
          }
          response.respondToJoinRequest = { id: requestId };
          break;
        }
        case "RemoveMem": {
          const teamId = variables?.teamId;
          const userId = variables?.userId;
          const teamIndex = db.teams.findIndex(t => t.id === teamId);
          if (teamIndex !== -1) {
            db.teams[teamIndex].members = db.teams[teamIndex].members.filter((m: any) => m.user.id !== userId);
            saveMockDb(db);
            response.removeMember = { id: teamId };
          }
          break;
        }
        case "Promote": {
          const teamId = variables?.teamId;
          const userId = variables?.userId;
          const role = variables?.role; // e.g. CO_LEAD or MEMBER
          const teamIndex = db.teams.findIndex(t => t.id === teamId);
          if (teamIndex !== -1) {
            const member = db.teams[teamIndex].members.find((m: any) => m.user.id === userId);
            if (member) {
              member.role = role;
              saveMockDb(db);
            }
            response.promote = { id: teamId };
          }
          break;
        }
        case "RequestJoin": {
          const teamId = variables?.teamId;
          const message = variables?.message;
          const team = db.teams.find(t => t.id === teamId);
          if (team && currentUser) {
            // Find lead to notify
            const lead = team.members.find((m: any) => m.role === "LEAD");
            db.notifications.push({
              id: `notif-${Date.now()}`,
              type: "JOIN_REQUEST",
              payload: JSON.stringify({ teamId, teamName: team.name, applicantName: currentUser.fullName, applicantId: currentUser.id, message }),
              read: false,
              createdAt: new Date().toISOString()
            });
            saveMockDb(db);
            response.requestJoin = { id: `req-${Date.now()}` };
          }
          break;
        }
        case "CreateProject": {
          const input = variables?.input || {};
          if (currentUser) {
            const newProj = {
              id: `proj-${Date.now()}`,
              title: input.title,
              description: input.description,
              constraints: input.constraints,
              disciplines: input.disciplines || ["SOEN"],
              teamSizeMin: input.teamSizeMin || 3,
              teamSizeMax: input.teamSizeMax || 4,
              status: "OPEN",
              owner: { id: currentUser.id, username: currentUser.username, fullName: currentUser.fullName },
              applications: [],
              createdAt: new Date().toISOString()
            };
            db.projects.push(newProj);
            saveMockDb(db);
            response.createProject = newProj;
          }
          break;
        }
        case "UpdateProjectDetails": {
          const id = variables?.id;
          const input = variables?.input || {};
          const projIndex = db.projects.findIndex(p => p.id === id);
          if (projIndex !== -1) {
            db.projects[projIndex] = {
              ...db.projects[projIndex],
              ...input
            };
            // Add notification to applying teams for material changes
            db.projects[projIndex].applications.forEach((app: any) => {
              db.notifications.push({
                id: `notif-${Date.now()}`,
                type: "PROJECT_CHANGED",
                payload: JSON.stringify({ projectId: id, projectTitle: db.projects[projIndex].title }),
                read: false,
                createdAt: new Date().toISOString()
              });
            });
            saveMockDb(db);
            response.updateProject = db.projects[projIndex];
          }
          break;
        }
        case "Apply": {
          const projectId = variables?.projectId;
          const teamId = variables?.teamId;
          const message = variables?.message;
          const projIndex = db.projects.findIndex(p => p.id === projectId);
          const team = db.teams.find(t => t.id === teamId);
          if (projIndex !== -1 && team) {
            const newApp = {
              id: `app-${Date.now()}`,
              status: "PENDING",
              message,
              createdAt: new Date().toISOString(),
              team: { id: team.id, name: team.name, isComplete: team.isComplete, maxSize: team.maxSize }
            };
            db.projects[projIndex].applications.push(newApp);
            saveMockDb(db);
            response.apply = newApp;
          }
          break;
        }
        case "SendOffer": {
          const applicationId = variables?.applicationId;
          // Find application in projects
          db.projects.forEach((proj) => {
            const app = proj.applications.find((a: any) => a.id === applicationId);
            if (app) {
              app.status = "ACCEPTED";
              proj.status = "CLAIMED";
              proj.team = app.team;
              // Notify team members
              db.notifications.push({
                id: `notif-${Date.now()}`,
                type: "OFFER_SENT",
                payload: JSON.stringify({ projectId: proj.id, projectTitle: proj.title, teamId: app.team.id }),
                read: false,
                createdAt: new Date().toISOString()
              });
            }
          });
          saveMockDb(db);
          response.sendOffer = { id: applicationId };
          break;
        }
        case "RejectApp": {
          const applicationId = variables?.applicationId;
          db.projects.forEach((proj) => {
            const app = proj.applications.find((a: any) => a.id === applicationId);
            if (app) {
              app.status = "REJECTED";
            }
          });
          saveMockDb(db);
          response.rejectApp = { id: applicationId };
          break;
        }
        case "RemoveUser": {
          const id = variables?.id;
          db.users = db.users.filter(u => u.id !== id);
          saveMockDb(db);
          response.removeUser = true;
          break;
        }
        case "RemoveTeam": {
          const id = variables?.id;
          const teamIndex = db.teams.findIndex(t => t.id === id);
          if (teamIndex !== -1) {
            db.teams[teamIndex].archived = true;
            saveMockDb(db);
          }
          response.removeTeam = true;
          break;
        }
        case "RemoveProject": {
          const id = variables?.id;
          const projIndex = db.projects.findIndex(p => p.id === id);
          if (projIndex !== -1) {
            db.projects[projIndex].archived = true;
            saveMockDb(db);
          }
          response.removeProject = true;
          break;
        }
        case "MarkNotification": {
          const id = variables?.id;
          const notif = db.notifications.find(n => n.id === id);
          if (notif) {
            notif.read = true;
            saveMockDb(db);
          }
          response.markNotificationRead = true;
          break;
        }
        case "Send":
        case "SendMessage": {
          const receiverId = variables?.receiverId;
          const body = variables?.body;
          if (currentUser && receiverId && body) {
            const receiver = db.users.find(u => u.id === receiverId) || { id: receiverId, username: "recipient", fullName: "Recipient" };
            const newMsg = {
              id: `msg-${Date.now()}`,
              body,
              read: false,
              createdAt: new Date().toISOString(),
              sender: { id: currentUser.id, username: currentUser.username, fullName: currentUser.fullName },
              receiver: { id: receiver.id, username: receiver.username, fullName: receiver.fullName }
            };
            db.messages.push(newMsg);
            saveMockDb(db);
            response.sendMessage = newMsg;
          }
          break;
        }
        case "MarkRead": {
          const id = variables?.id;
          const msg = db.messages.find(m => m.id === id);
          if (msg) {
            msg.read = true;
            saveMockDb(db);
          }
          response.markRead = true;
          break;
        }
        case "Sign":
        case "SignUpload": {
          response.signUpload = {
            url: "https://httpbin.org/post",
            key: `mock-key-${Date.now()}`,
            publicUrl: "https://quorum.s3.amazonaws.com/uploads/mock_resume.pdf",
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            fields: [{ name: "acl", value: "public-read" }]
          };
          break;
        }
        default: {
          response.success = true;
        }
      }
    }

    return response as T;
  } catch (e) {
    console.error("[GraphQL Mock DB Error]", e);
    throw e;
  }
}

export async function uploadToSignedPost(file: File, signature: { url: string; fields: { name: string; value: string }[] }) {
  console.log("[GraphQL Mock DB] Simulating file upload to mock cloud signature bucket", file.name);
  return new Promise(resolve => setTimeout(resolve, 600));
}

export function useGraphQL<T>(query: string, variables?: Record<string, any>, options?: { auth?: boolean; skip?: boolean }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const variablesKey = JSON.stringify(variables || {});

  const load = useCallback(async () => {
    if (options?.skip) return;
    setLoading(true);
    setError(null);
    try {
      const parsedVariables = JSON.parse(variablesKey) as Record<string, any>;
      setData(await graphqlRequest<T>(query, parsedVariables, options?.auth ? getAuthToken() : undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown GraphQL error");
    } finally {
      setLoading(false);
    }
  }, [query, variablesKey, options?.auth, options?.skip]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}


