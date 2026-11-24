# ClientDesk

**Open-source, offline-first customer support and ticket management platform for small businesses and teams.**

ClientDesk is a modern customer support management application designed to help small businesses organize customer issues, manage support requests, collaborate with team members and track resolutions through a centralized workspace.

Built with React Native, Expo, TypeScript and Supabase, ClientDesk focuses on simplicity, reliability, extensibility and an offline-first mobile experience.

> Every issue tracked. Every task assigned. Every resolution recorded.

---

## 1. Overview

### What is ClientDesk?

ClientDesk is a workspace-based support ticket management platform.

It provides businesses with a structured environment to manage customer complaints, technical issues, service requests and other support-related activities.

Instead of relying on disconnected communication channels, spreadsheets or informal conversations, teams can use ClientDesk to maintain a centralized record of customer issues and their resolution history.

Each issue is represented as a ticket that can be created, prioritized, assigned, discussed, updated and resolved.

### Key Objectives

- Simplify customer support operations for small businesses.
- Centralize support requests in a single workspace.
- Improve collaboration between team members.
- Provide clear ownership and visibility for every ticket.
- Maintain a complete history of support activities.
- Support ticket management without continuous internet connectivity.
- Provide a modular and extensible foundation for future integrations.

---

## 2. Core Features

### 2.1 Authentication and Account Management

Secure user authentication and account management.

- Email and password registration.
- Email and password login.
- Google OAuth authentication.
- Password recovery and reset.
- Secure session management.
- Automatic session restoration.
- Token refresh and expiration handling.
- Account deletion.

### 2.2 Workspace Management

ClientDesk supports multiple independent company workspaces.

Each workspace represents an organization or business using the platform.

Features:

- Create company workspaces.
- Manage workspace information.
- Invite team members through email.
- Accept and manage invitations.
- View workspace membership.
- Remove team members.
- Maintain workspace-level data isolation.

A user can belong to multiple workspaces, subject to their membership and permissions.

### 2.3 Role-Based Access Control

ClientDesk provides two initial workspace roles.

| Permission | Owner | Member |
|---|---|---|
| View tickets | Yes | Yes |
| Create tickets | Yes | Yes |
| Edit tickets | Yes | Yes |
| Assign tickets | Yes | Yes |
| Update ticket status | Yes | Yes |
| Manage comments | Yes | Yes |
| Upload attachments | Yes | Yes |
| Invite members | Yes | No |
| Remove members | Yes | No |
| Manage workspace settings | Yes | No |
| Delete workspace | Yes | No |

Authorization is enforced at the backend level rather than relying exclusively on frontend visibility.

### 2.4 Ticket Management

The primary functionality of ClientDesk.

Users can create and manage support tickets containing:

- Ticket identifier.
- Subject.
- Description.
- Customer name.
- Customer email.
- Priority.
- Status.
- Assigned team member.
- Creation and modification timestamps.

Supported operations:

- Create tickets.
- View ticket details.
- Edit tickets.
- Assign tickets to team members.
- Change priority.
- Update ticket status.
- Resolve and close tickets.
- Search tickets.
- Filter tickets.
- Paginate ticket listings.
- Refresh ticket information.

#### Ticket Priorities

| Priority | Description |
|---|---|
| Low | Minor issue |
| Medium | Normal support request |
| High | Important issue requiring attention |
| Urgent | Critical issue requiring immediate attention |

#### Ticket Statuses

| Status | Description |
|---|---|
| Open | Newly created or awaiting investigation |
| In Progress | Currently being handled |
| Resolved | Issue has been addressed |
| Closed | Support process has been completed |

### 2.5 Comments and Collaboration

Team members can collaborate through ticket-level discussions.

- Add comments.
- View discussion history.
- Identify comment authors.
- Display timestamps.
- Maintain chronological conversations.

The initial implementation supports internal team comments rather than direct customer messaging.

### 2.6 File Attachments

Tickets can contain supporting files and documents.

- Image attachments.
- Document attachments.
- File upload.
- Attachment metadata.
- File preview and download where supported.

File access is restricted to authorized workspace members.

### 2.7 Dashboard and Overview

The dashboard provides an overview of support activities within the active workspace.

Information includes:

- Total tickets.
- Open tickets.
- In-progress tickets.
- Resolved tickets.
- Closed tickets.
- High-priority tickets.
- Recently created tickets.
- Tickets assigned to the current user.
- Recent workspace activity.

### 2.8 Push Notifications

ClientDesk supports push notifications for important ticket events.

Initial notification functionality includes:

- New ticket assignment notifications.
- Notification history.
- Read/unread notification state.
- Notification interaction handling.

Notifications are delivered through a backend notification workflow and Expo Push Notification Service.

### 2.9 Deep Linking

The application supports navigation to specific tickets through deep links.

Example:

`clientdesk://tickets/{ticketId}`

Opening a ticket notification should navigate directly to the corresponding ticket after authentication and authorization checks.

### 2.10 Offline-First Functionality

ClientDesk is designed to remain useful when network connectivity is unavailable.

Offline capabilities include:

- Locally cached ticket information.
- Local ticket creation.
- Local ticket modifications.
- Optimistic UI updates.
- Persistent synchronization queue.
- Automatic synchronization when connectivity returns.
- Retry handling.
- Conflict detection and resolution.

SQLite is used for local persistence.

### 2.11 Application Settings

- User profile management.
- Dark mode.
- Light mode.
- System appearance preference.
- Privacy information.
- Terms and conditions.
- Account management.
- Logout.

---

## 3. Application Architecture

ClientDesk follows a feature-based, layered architecture.

The architecture separates presentation, application logic, data access and infrastructure to improve maintainability, testability and extensibility.

### 3.1 High-Level Architecture

```text
                 CLIENTDESK
                      |
          React Native / Expo
                      |
              Expo Router
                      |
             Presentation Layer
                      |
              Application Layer
          (Features / Services / Hooks)
                      |
                 Data Layer
                      |
              Repository Layer
                 /       \
                /         \
          Local Data    Remote Data
              |              |
           SQLite        Supabase
                             |
                      PostgreSQL
                             |
             Auth / Storage / Realtime
                             |
                    Edge Functions
                             |
                External Integrations
```

### 3.2 Architecture Layers

**Presentation Layer**

Responsible for the mobile interface.

Includes:
- Screens.
- Reusable UI components.
- Navigation.
- Forms.
- Visual states.

**Application Layer**

Responsible for business operations.

Includes:
- Authentication workflows.
- Workspace management.
- Ticket operations.
- Assignment workflows.
- Validation.
- Application services.

**Data Layer**

Responsible for data persistence and retrieval.

Includes:
- Repository interfaces and implementations.
- Remote data access.
- Local database access.
- Caching.
- Synchronization.
- Offline operation queues.

**Infrastructure Layer**

Responsible for external services and native capabilities.

Includes:
- Supabase.
- PostgreSQL.
- Supabase Storage.
- Expo Notifications.
- SecureStore.
- Sentry.
- Analytics integrations.

### 3.3 Architectural Principles

- Separation of concerns.
- Feature-based modularity.
- Reusable components.
- Strong TypeScript typing.
- Centralized error handling.
- Repository-based data access.
- Backend-enforced authorization.
- Multi-tenant data isolation.
- Offline-first data management.
- Testable business logic.

---

## 4. Technology Stack

### Mobile Application

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile development |
| Expo | Application development and native build infrastructure |
| TypeScript | Static typing |
| Expo Router | File-based navigation |
| React Hook Form | Form management |
| Zod | Schema validation |
| Zustand | Client-side state management |
| TanStack Query | Server state and caching |

### Backend

| Technology | Purpose |
|---|---|
| Supabase | Backend platform |
| PostgreSQL | Relational database |
| Supabase Auth | Authentication |
| Supabase Storage | File storage |
| Supabase Realtime | Realtime data updates |
| Supabase Edge Functions | Server-side operations |

### Offline Infrastructure

| Technology | Purpose |
|---|---|
| Expo SQLite | Local persistence |
| Expo Network | Connectivity detection |
| Custom Sync Engine | Offline synchronization |
| TanStack Query | Remote caching |

### Native Integrations

| Technology | Purpose |
|---|---|
| Expo SecureStore | Secure credential storage |
| Expo Notifications | Push notifications |
| Expo Linking | Deep linking |
| Expo Image Picker | Image selection |
| Expo Document Picker | Document selection |

### Development and Quality

| Technology | Purpose |
|---|---|
| ESLint | Code quality |
| Jest | Unit testing |
| React Native Testing Library | Component testing |
| Maestro | End-to-end testing |
| GitHub Actions | Continuous integration |
| Sentry | Crash reporting |
| EAS Build | Application builds |

---

## 5. Database Design

ClientDesk uses PostgreSQL as its primary database.

The database follows a relational, workspace-oriented structure.

### Core Entities

| Entity | Responsibility |
|---|---|
| profiles | User profile information |
| workspaces | Company workspace information |
| workspace_members | Workspace membership and roles |
| invitations | Team invitations |
| tickets | Customer support tickets |
| comments | Ticket discussions |
| attachments | Ticket file metadata |
| notifications | User notifications |
| ticket_events | Ticket activity history |
| device_tokens | Push notification device registrations |

### Multi-Tenancy

Workspace isolation is a fundamental requirement.

Every workspace-owned record must be associated with a workspace identifier.

Users can only access records belonging to workspaces in which they have valid membership.

PostgreSQL Row Level Security (RLS) is used to enforce data access policies.

The backend must validate membership, roles, assignments and workspace ownership for all sensitive operations.

---

## 6. Offline Synchronization

ClientDesk uses an offline-first data architecture.

### Synchronization Workflow

```text
User performs an operation
          |
          v
     Validate input
          |
          v
      Save locally
          |
          v
   Update application UI
          |
          v
   Add operation to outbox
          |
          v
    Check connectivity
          |
     +----+----+
     |         |
   Online    Offline
     |         |
     v         v
  Sync now   Wait for
     |       connection
     |         |
     +----+----+
          |
          v
   Send to backend
          |
          v
   Server confirmation
          |
          v
   Update local state
```

### Synchronization Requirements

- Persistent local operation queue.
- Stable operation identifiers.
- Idempotent backend operations.
- Retry mechanisms.
- Safe operation ordering.
- Synchronization status tracking.
- Conflict detection.
- Recovery after application restarts.

Pending operations must not be silently discarded.

---

## 7. Security

Security is implemented across the application and backend.

### Authentication

- Secure session persistence.
- Token refresh.
- Protected routes.
- Session expiration handling.
- No plaintext password storage.

### Authorization

- Backend-enforced roles.
- Workspace-based access control.
- PostgreSQL RLS.
- Invitation validation.
- Assignment validation.

### Data Protection

- Restricted attachment access.
- Secure storage of authentication credentials.
- Environment-based configuration.
- No service-role credentials in the mobile application.
- Appropriate handling of personal information.

### API and Infrastructure Security

- Trusted backend operations.
- Validated user input.
- Secure notification delivery.
- Restricted file uploads.
- Server-side authorization checks.

---

## 8. Project Structure

```text
clientdesk/
│
├── app/
│   ├── (auth)/
│   ├── (onboarding)/
│   ├── (app)/
│   └── _layout.tsx
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   └── layout/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── workspace/
│   │   ├── tickets/
│   │   ├── comments/
│   │   ├── team/
│   │   ├── notifications/
│   │   └── settings/
│   │
│   ├── services/
│   ├── database/
│   │   ├── migrations/
│   │   └── repositories/
│   │
│   ├── sync/
│   ├── hooks/
│   ├── stores/
│   ├── providers/
│   ├── constants/
│   ├── types/
│   ├── utils/
│   └── validation/
│
├── assets/
├── tests/
├── supabase/
│   ├── migrations/
│   └── functions/
│
├── .github/
│   └── workflows/
│
├── .env.example
├── app.config.ts
├── eas.json
├── tsconfig.json
├── eslint.config.js
├── package.json
├── README.md
├── PROJECT.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
```

The directory structure may evolve as the project grows.

---

## 9. Development Setup

### Prerequisites

- Node.js (LTS).
- npm.
- Git.
- Expo CLI through `npx expo`.
- Supabase project.
- Android Studio or a compatible Android development environment.
- Expo development build for native functionality.

### Clone the Repository

```bash
git clone <repository-url>
cd clientdesk
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file using `.env.example`.

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Only public client configuration belongs in the mobile application environment.

Never expose service-role keys or private credentials.

### Configure Supabase

1. Create a Supabase project.
2. Configure authentication providers.
3. Apply database migrations.
4. Configure Row Level Security.
5. Configure storage buckets and access policies.
6. Deploy required Edge Functions.
7. Configure OAuth redirect URLs.
8. Configure notification infrastructure.

### Start Development

```bash
npx expo start --dev-client
```

For a native Android development build:

```bash
npx expo run:android
```

### Quality Checks

```bash
npx eslint .
npx tsc --noEmit
npm test
```

Commands should be aligned with the scripts configured in `package.json`.

---

## 10. Testing Strategy

ClientDesk aims to maintain reliable application behavior through automated and manual testing.

### Unit Testing

Use Jest to test:

- Ticket validation.
- Status transitions.
- Priority handling.
- Permission logic.
- Ticket filtering.
- Outbox operations.
- Synchronization logic.
- Conflict resolution.

### Component Testing

Use React Native Testing Library to test:

- Authentication forms.
- Ticket forms.
- Ticket cards.
- Loading states.
- Empty states.
- Error states.

### End-to-End Testing

Use Maestro for important application workflows.

Suggested workflow:

1. Register a user.
2. Create a workspace.
3. Invite a teammate.
4. Accept the invitation.
5. Log in as the invited user.
6. Create a ticket.
7. Assign the ticket.
8. Verify ticket visibility across workspace members.

### Manual Testing

- Authentication.
- Workspace isolation.
- Role permissions.
- Ticket operations.
- Attachments.
- Offline behavior.
- Synchronization.
- Notifications.
- Deep links.
- Application restart.

---

## 11. Monitoring and Analytics

### Crash Reporting

Sentry is used to monitor application crashes and relevant errors.

### Analytics

An analytics provider can be integrated to understand application usage.

Initial tracked events may include:

- `user_registered`
- `workspace_created`
- `ticket_created`
- `ticket_assigned`
- `ticket_resolved`

Analytics must avoid collecting unnecessary personal or sensitive information.

---

## 12. Design Philosophy

ClientDesk follows a modern, minimal and functional design approach.

### Design Principles

- Dark-first interface with light mode support.
- Clear visual hierarchy.
- Minimal unnecessary interactions.
- Consistent spacing and typography.
- Reusable UI components.
- Accessible colors and controls.
- Clear loading and error feedback.
- Mobile-first layouts.

### UI Guidelines

| Element | Direction |
|---|---|
| Typography | Inter |
| Primary color | Indigo / Blue |
| Background | Near-black |
| Surface | Charcoal |
| Radius | 12–16 px |
| Navigation | Bottom navigation |
| Feedback | Toasts and dialogs |
| Layout | Mobile-first |

The interface should prioritize usability and operational clarity over unnecessary visual complexity.

---

## 13. Roadmap

The roadmap represents the intended evolution of ClientDesk. Features are subject to implementation priority and community contributions.

### Phase 1 — Core Foundation

- [x] Project concept and architecture definition
- [ ] React Native and Expo foundation
- [ ] Authentication
- [ ] Workspace creation
- [ ] Team invitations
- [ ] Role-based access control
- [ ] Initial database implementation

### Phase 2 — Ticket Management

- [ ] Ticket CRUD
- [ ] Priority and status management
- [ ] Ticket assignments
- [ ] Comments
- [ ] Attachments
- [ ] Search and filtering
- [ ] Dashboard

### Phase 3 — Offline and Notifications

- [ ] SQLite persistence
- [ ] Optimistic updates
- [ ] Offline operation queue
- [ ] Automatic synchronization
- [ ] Conflict handling
- [ ] Push notifications
- [ ] Deep linking

### Phase 4 — Reliability and Release

- [ ] Unit tests
- [ ] End-to-end tests
- [ ] Accessibility improvements
- [ ] Sentry integration
- [ ] Analytics integration
- [ ] CI/CD
- [ ] Android release build
- [ ] Documentation

### Future Possibilities

- Customer-facing support portal.
- Web application.
- iOS application.
- Email-to-ticket integration.
- WhatsApp integration.
- Customer self-service.
- SLA management.
- Advanced analytics.
- Custom ticket fields.
- Ticket automation.
- AI-assisted ticket classification.
- AI-generated response suggestions.
- Knowledge base.
- Additional workspace roles and permissions.

---

## 14. Contributing

Contributions, bug reports, suggestions and improvements are welcome.

### Contribution Guidelines

1. Fork the repository.
2. Create a feature branch.
3. Implement the proposed changes.
4. Follow the existing architecture and coding conventions.
5. Add or update relevant tests.
6. Run linting and tests.
7. Submit a pull request with a clear description.

### Suggested Branch Naming

```text
feature/ticket-management
feature/offline-sync
fix/authentication-session
fix/ticket-assignment
docs/installation-guide
```

### Pull Request Expectations

- Clear description of the change.
- Relevant issue reference where applicable.
- Screenshots for UI changes.
- Tests for new business logic.
- No committed secrets or credentials.
- No unrelated modifications.

Refer to `CONTRIBUTING.md` for detailed contribution instructions.

---

## 15. Security and Vulnerability Reporting

Security vulnerabilities should be reported privately rather than disclosed through public issue discussions.

Refer to `SECURITY.md` for the security reporting process.

Security-sensitive areas include:

- Authentication and session management.
- Workspace isolation.
- Authorization policies.
- File access.
- Invitation handling.
- Offline data handling.
- Notification delivery.

Never include credentials, access tokens or private user information in public bug reports.

---

## 16. Licensing

ClientDesk is intended to be developed as an open-source project.

The repository should include a `LICENSE` file specifying the actual license under which the project is distributed.

Until a license is selected and added, the repository's licensing status should be treated as unspecified.

All contributions must comply with the project's chosen license and contribution policies.

---

## 17. Project Principles

The long-term development of ClientDesk follows these principles:

**Simplicity**

Keep the application easy to understand and operate.

**Reliability**

Prioritize correct data handling, predictable synchronization and stable application behavior.

**Security**

Enforce authentication, authorization and workspace isolation at the appropriate backend boundaries.

**Modularity**

Build independent, maintainable modules that can evolve without unnecessary coupling.

**Offline First**

Treat connectivity as an unreliable resource rather than a permanent requirement.

**Extensibility**

Allow future integrations, features and platform support without requiring a complete architectural rewrite.

**Community**

Encourage transparent development, useful documentation and meaningful contributions.

---

## 18. Project Status

ClientDesk is under active development.

The initial release focuses on the core mobile ticket management experience, workspace collaboration, secure access control and offline functionality.

Features and implementation details may evolve as development progresses.

---

## ClientDesk

**Every issue tracked. Every task assigned. Every resolution recorded.**

A simpler way for teams to manage customer support.

