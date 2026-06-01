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
  createdAt
  createdBy { id username fullName discipline }
  members { id role joinedAt user { id username fullName discipline } }
  project { id title description status }
`;

export const PROJECT_CARD_FIELDS = `
  id
  title
  description
  constraints
  disciplines
  teamSizeMin
  teamSizeMax
  status
  fileUrl
  videoUrl
  createdAt
  owner { id username fullName discipline }
  team { id name isComplete maxSize discipline createdBy { id username fullName } members { id role joinedAt user { id username fullName discipline } } }
`;

export const HOME_QUERY = `
  query Home {
    teams { ${TEAM_CARD_FIELDS} }
    projects { ${PROJECT_CARD_FIELDS} applications { id status message createdAt team { ${TEAM_CARD_FIELDS} } } }
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
    project(id: $id) { ${PROJECT_CARD_FIELDS} applications { id status message createdAt team { ${TEAM_CARD_FIELDS} } } }
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
    projects { ${PROJECT_CARD_FIELDS} applications { id status message createdAt team { id name isComplete maxSize createdBy { id username fullName } members { id role joinedAt user { id username fullName } } } } }
  }
`;
