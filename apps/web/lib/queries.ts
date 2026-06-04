export const USER_FIELDS = `
  id
  authUserId
  username
  email
  fullName
  bio
  discipline
  university
  linkedinUrl
  githubUrl
  portfolioUrl
  resumeUrl
  avatarUrl
  userIntent
  resumeVisibility
  discord
  availabilityNote
  preferredProjectAreas
  profileComplete
  deactivatedAt
  archivedAt
  createdAt
  tags { id name isPredefined }
`;

export const TEAM_CARD_FIELDS = `
  id
  name
  description
  isComplete
  maxSize
  discipline
  recruitingState
  capstoneState
  visibility
  discordLink
  existingSkills
  neededSkills
  projectInterests
  archivedAt
  permissions { canEdit canManageMembers canInviteMembers canArchive canApplyToProjects }
  createdAt
  createdBy { id username fullName discipline }
  members { id role joinedAt user { id username fullName discipline } }
  project { id title summary description status lifecycleState }
`;

export const PROJECT_CARD_FIELDS = `
  id
  title
  summary
  description
  constraints
  disciplines
  teamSizeMin
  teamSizeMax
  status
  lifecycleState
  approvalState
  requiredSkills
  niceToHaveSkills
  deliverables
  timeline
  evaluationCriteria
  externalResources
  ownerContactPreference
  applicationQuestions
  archivedAt
  permissions { canEdit canReviewApplications canSubmitForApproval canApprove canArchive }
  fileUrl
  videoUrl
  createdAt
  owner { id username fullName discipline }
  team { id name isComplete maxSize discipline createdBy { id username fullName } members { id role joinedAt user { id username fullName discipline } } }
`;

export const HOME_QUERY = `
  query Home {
    teams { ${TEAM_CARD_FIELDS} }
    projects { ${PROJECT_CARD_FIELDS} applications { id status message answers reviewMessage offerMessage expiresAt teamConfirmedAt ownerConfirmedAt withdrawnAt createdAt team { ${TEAM_CARD_FIELDS} } } }
  }
`;

export const TEAMS_QUERY = `
  query Teams($search: String) {
    teams(search: $search) { ${TEAM_CARD_FIELDS} }
  }
`;

export const TEAM_QUERY = `
  query Team($id: ID!) {
    team(id: $id) { ${TEAM_CARD_FIELDS} }
  }
`;

export const PROJECTS_QUERY = `
  query Projects($search: String) {
    projects(search: $search) { ${PROJECT_CARD_FIELDS} applications { id status message createdAt team { ${TEAM_CARD_FIELDS} } } }
  }
`;

export const PROJECT_QUERY = `
  query Project($id: ID!) {
    project(id: $id) { ${PROJECT_CARD_FIELDS} applications { id status message answers reviewMessage offerMessage expiresAt teamConfirmedAt ownerConfirmedAt withdrawnAt createdAt team { ${TEAM_CARD_FIELDS} } } }
  }
`;

export const PROFILE_QUERY = `
  query Profile($username: String!) {
    user(username: $username) { ${USER_FIELDS} }
  }
`;

export const ME_QUERY = `
  query Me {
    me { ${USER_FIELDS} }
  }
`;

export const INBOX_QUERY = `
  query Inbox {
    me { id username fullName }
    myInbox { id username fullName discipline }
  }
`;

export const MESSAGES_QUERY = `
  query Messages($withUser: ID!) {
    myMessages(withUser: $withUser) {
      id
      body
      read
      createdAt
      sender { id username fullName }
      receiver { id username fullName }
    }
  }
`;

export const NOTIFICATIONS_QUERY = `
  query Notifications {
    myNotifications { id type payload read createdAt }
  }
`;

export const ADMIN_QUERY = `
  query Admin {
    users { ${USER_FIELDS} }
    teams { ${TEAM_CARD_FIELDS} }
    projects { ${PROJECT_CARD_FIELDS} applications { id status message answers reviewMessage offerMessage expiresAt createdAt team { id name isComplete maxSize createdBy { id username fullName } members { id role joinedAt user { id username fullName } } } } }
    auditLogs(limit: 100) { id actionType targetEntityType targetEntityId reason createdAt actor { id username email fullName } }
  }
`;

export const DASHBOARD_CONTEXT_QUERY = `
  query DashboardContext {
    dashboardContext {
      unreadMessages
      unreadNotifications
      isAdmin
      universalDeadline { id deadlineAt updatedAt }
      myTeams { ${TEAM_CARD_FIELDS} }
      myProjects { ${PROJECT_CARD_FIELDS} applications { id status message answers createdAt team { ${TEAM_CARD_FIELDS} } } }
      myInvitations { id status message expiresAt createdAt team { id name createdBy { id username fullName } } invitedBy { id username fullName } }
    }
    myNotifications { id type payload read createdAt }
  }
`;
