/** Consumer plans, as in the App Core plan switcher. */
export const CONSUMER_PLANS = ['buyer', 'seller', 'bundle', 'tenant', 'landlord'] as const;
export type ConsumerPlan = (typeof CONSUMER_PLANS)[number];

/** Staff and partner roles served by Klyr Pro and Admin. */
export const STAFF_ROLES = ['agent', 'broker_of_record', 'compliance_officer', 'privacy_officer', 'ops', 'admin'] as const;
export const PROVIDER_ROLES = ['lawyer', 'lender', 'inspector', 'insurer'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type ProviderRole = (typeof PROVIDER_ROLES)[number];
export type Role = ConsumerPlan | StaffRole | ProviderRole;
