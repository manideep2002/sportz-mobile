export const LEGAL_DOCUMENT_VERSIONS = {
  terms: '2026-07-28',
  privacy: '2026-07-28'
} as const;

export type LegalDocumentKind = keyof typeof LEGAL_DOCUMENT_VERSIONS;

export type LegalDocumentSection = {
  heading: string;
  paragraphs: readonly string[];
};

export type LegalDocument = {
  title: string;
  version: string;
  effectiveDate: string;
  intro: string;
  sections: readonly LegalDocumentSection[];
};

export const legalDocuments: Record<LegalDocumentKind, LegalDocument> = {
  terms: {
    title: 'Terms of Service',
    version: LEGAL_DOCUMENT_VERSIONS.terms,
    effectiveDate: '28 July 2026',
    intro:
      'These Terms govern your use of SPORTZ. By creating an account or using SPORTZ, you agree to these Terms.',
    sections: [
      {
        heading: '1. Your account',
        paragraphs: [
          'You must be at least 13 years old and provide accurate account information. You are responsible for keeping your sign-in credentials secure and for activity performed through your account.',
          'You may not impersonate another person, create an account for someone without permission, or use SPORTZ if applicable law prevents you from doing so.'
        ]
      },
      {
        heading: '2. Using SPORTZ',
        paragraphs: [
          'SPORTZ helps athletes, teams, communities, event organisers, and sports venues connect. You must use the service lawfully and respect other people’s safety, privacy, and rights.',
          'Do not harass others, post illegal or deceptive material, interfere with the service, scrape it without permission, evade security controls, or use SPORTZ to send spam.'
        ]
      },
      {
        heading: '3. Your content',
        paragraphs: [
          'You keep ownership of content you submit. You give SPORTZ a worldwide, non-exclusive, royalty-free licence to host, reproduce, adapt, display, and distribute that content only as needed to operate, improve, secure, and promote the service.',
          'You must have the rights and permissions needed to submit your content. You can remove content using available product controls, subject to reasonable backup, legal, and safety retention.'
        ]
      },
      {
        heading: '4. Events, bookings, and offers',
        paragraphs: [
          'Event organisers, venue operators, teams, and other users are responsible for the information, commitments, and services they provide. SPORTZ is not a party to arrangements between users unless we expressly say otherwise.',
          'Participation in sport involves risk. Use appropriate judgement, equipment, supervision, and medical advice. Emergency or professional services should be contacted when needed.'
        ]
      },
      {
        heading: '5. Enforcement and account closure',
        paragraphs: [
          'We may remove content, limit features, suspend accounts, or terminate access when reasonably necessary to protect users, comply with law, investigate misuse, or enforce these Terms.',
          'You can stop using SPORTZ or request account deletion from Account security. Provisions that by their nature should survive termination will continue to apply.'
        ]
      },
      {
        heading: '6. Service availability and liability',
        paragraphs: [
          'We work to keep SPORTZ reliable, but the service is provided on an “as available” basis. Features may change and interruptions may occur.',
          'To the extent permitted by law, SPORTZ is not liable for indirect or consequential losses or for user-provided content and services. Nothing in these Terms excludes rights or liability that cannot legally be excluded.'
        ]
      },
      {
        heading: '7. Changes and contact',
        paragraphs: [
          'If we materially change these Terms, we will update the version and provide notice when required. Continued use after the new terms take effect means you accept them where the law permits.',
          'Questions about these Terms can be sent through Help & Support in the app.'
        ]
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    version: LEGAL_DOCUMENT_VERSIONS.privacy,
    effectiveDate: '28 July 2026',
    intro:
      'This Privacy Policy explains what information SPORTZ processes, why we use it, and the choices available to you.',
    sections: [
      {
        heading: '1. Information we collect',
        paragraphs: [
          'We collect information you provide, including account details, profile information, sports interests, posts, messages, event activity, bookings, reports, and support requests.',
          'With your permission, we may process photos, videos, camera input, and approximate or precise location for the feature you choose. We also collect device, app, security, and diagnostic data needed to operate SPORTZ.'
        ]
      },
      {
        heading: '2. How we use information',
        paragraphs: [
          'We use information to provide and personalise SPORTZ, connect users, process bookings and event activity, deliver notifications, secure accounts, prevent abuse, provide support, analyse reliability, and comply with law.',
          'We do not sell personal information. We use information only where we have an appropriate legal basis, such as performing our agreement with you, legitimate interests, consent, or a legal obligation.'
        ]
      },
      {
        heading: '3. Sharing',
        paragraphs: [
          'Profile and content visibility depends on your settings and the feature used. Messages and private community activity are shared with their intended participants.',
          'We share limited information with service providers that host, secure, analyse, or support SPORTZ under contractual safeguards. We may also disclose information for legal compliance, safety, fraud prevention, or a business transfer.'
        ]
      },
      {
        heading: '4. Retention and security',
        paragraphs: [
          'We retain information for as long as needed to provide SPORTZ and for legitimate security, dispute, backup, and legal purposes. Retention varies by data type and account status.',
          'We use technical and organisational safeguards designed to protect information, but no system can guarantee absolute security. Keep your credentials private and report suspected account misuse.'
        ]
      },
      {
        heading: '5. Your controls and rights',
        paragraphs: [
          'Use Privacy & Security to control account visibility and blocking, and Notification settings to manage push alerts. Device settings control permissions such as camera, photos, and location.',
          'Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or export personal information, and to withdraw consent. You may request account deletion from Account security.'
        ]
      },
      {
        heading: '6. Children and international processing',
        paragraphs: [
          'SPORTZ is not intended for children under 13. If you believe a child under 13 has provided personal information, contact us through Help & Support.',
          'Information may be processed in countries other than your own. Where required, we use recognised safeguards for international transfers.'
        ]
      },
      {
        heading: '7. Changes and contact',
        paragraphs: [
          'If we materially change this Policy, we will update the version and provide notice when required.',
          'Privacy questions and rights requests can be submitted through Help & Support in the app.'
        ]
      }
    ]
  }
};
