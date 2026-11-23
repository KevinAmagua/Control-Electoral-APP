import type { Dignity } from './dignity';

export type Candidate = {
  id: string;
  organizationId: string;
  dignity: Dignity;
  fullName: string;
  listNumber: number;
  active: boolean;
};
