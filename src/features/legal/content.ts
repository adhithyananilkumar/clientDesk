/**
 * Privacy policy and terms shown in the app (and linked from the store listing).
 * Plain-language drafts describing how ClientDesk actually works; have them
 * reviewed before publishing, and bump LEGAL_UPDATED when the text changes.
 */
export const LEGAL_UPDATED = '27 November 2026';
export const LEGAL_CONTACT = 'support@clientdesk.app';

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  intro: 'ClientDesk is a ticketing app for teams. This explains what we collect, why, and the choices you have.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Account details: your name, email address, and profile photo if you add one. If you sign in with Google, we receive your name and email from Google.',
        'Workspace content: tickets, comments, internal notes, attachments, categories and activity history that you and your teammates create.',
        'Device details: a push notification token for each device where you allow notifications, and basic crash reports (device model, OS version, error details) so we can fix problems.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        'To run the service: sign you in, show your workspaces, sync tickets across devices and send the notifications you’ve turned on.',
        'To keep it working and secure: diagnose crashes, prevent abuse and enforce workspace permissions.',
        'We don’t sell your data or use it for advertising.',
      ],
    },
    {
      heading: 'Who can see it',
      body: [
        'People in your workspace, according to its permissions: owners and admins see all tickets; members see tickets they created or are assigned to unless the owner allows more. Internal notes are visible to owners and admins only.',
        'Service providers that host the app for us: Supabase (database, sign-in, file storage), Expo (push notification delivery), Sentry (crash reports) and our email provider (invitations). They process data only on our behalf.',
      ],
    },
    {
      heading: 'On your device',
      body: [
        'To work offline, the app keeps a copy of recently viewed workspace data, drafts and unsent changes on your device. Signing out removes it.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'Edit your profile at any time. Turn notification types on or off in Notification settings, or turn off notifications for the app in your device settings.',
        'Delete your account from Security → Delete account. This removes your profile, comments, uploaded files and any workspace where you’re the only member. Tickets you created stay with your team without your name.',
      ],
    },
    {
      heading: 'Retention and security',
      body: [
        'We keep your data while your account exists. Deleted accounts are removed right away; backups roll over within 30 days.',
        'Data is encrypted in transit, files are stored privately and served through short-lived links, and every database request is checked against workspace permissions.',
      ],
    },
    {
      heading: 'Children',
      body: ['ClientDesk is meant for work and isn’t directed at children under 13.'],
    },
    {
      heading: 'Contact',
      body: [`Questions or requests: ${LEGAL_CONTACT}. We’ll update this page and the date above if anything changes.`],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of service',
  intro: 'These terms apply when you use ClientDesk. By creating an account you agree to them.',
  sections: [
    {
      heading: 'Your account',
      body: [
        'Give accurate details and keep your password safe. You’re responsible for what happens under your account.',
        'You must be old enough to agree to these terms where you live, and at least 13.',
      ],
    },
    {
      heading: 'Workspaces',
      body: [
        'The owner of a workspace controls who joins it, their roles and its settings, and can remove members or delete the workspace.',
        'If you use ClientDesk for an organisation, you confirm you’re allowed to act for it.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'You keep ownership of what you add. You let us store, process and show it to the people your workspace permissions allow, only to run the service.',
        'Only upload content you have the right to share.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Don’t use ClientDesk to break the law, harass people, send spam, upload malware, or try to access data you aren’t allowed to see or disrupt the service.',
        'We may suspend accounts that do.',
      ],
    },
    {
      heading: 'The service',
      body: [
        'We work to keep ClientDesk available and your data safe, but it’s provided “as is”. Features may change, and we may stop offering it with reasonable notice.',
        'To the extent the law allows, we aren’t liable for indirect losses or for lost data or profits.',
      ],
    },
    {
      heading: 'Ending',
      body: ['You can delete your account at any time from Security → Delete account.'],
    },
    {
      heading: 'Changes and contact',
      body: [`We’ll update the date above when these terms change. Questions: ${LEGAL_CONTACT}.`],
    },
  ],
};
