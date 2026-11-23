export type Assignment = {
  id: string;
  mesaId: string;
  veedorId: string;
  assignedBy: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  active: boolean;
  replacesAssignmentId: string | null;
  reason: string | null;
};

export type ReplaceVeedorInput = {
  mesaIds: string[];
  previousVeedorId: string;
  nextVeedorId: string;
  reason: string;
};
