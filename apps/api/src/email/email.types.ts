export type StaffRole = 'manager' | 'cashier';
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  secret?: { kind: 'staff' | 'reset' | 'partner'; referenceId: string };
};
