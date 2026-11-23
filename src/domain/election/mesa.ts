export type Mesa = {
  id: string;
  recintoId?: string;
  number: string;
  location: string;
  registeredVoters: number;
  status: 'pendiente' | 'verificada';
  active?: boolean;
};

export const MESAS: readonly Mesa[] = [
  {
    id: 'mesa-001',
    number: '001',
    location: 'Escuela Fiscal Quito Sur',
    registeredVoters: 312,
    status: 'verificada',
  },
  {
    id: 'mesa-002',
    number: '002',
    location: 'Colegio Nacional Técnico',
    registeredVoters: 298,
    status: 'pendiente',
  },
  {
    id: 'mesa-003',
    number: '003',
    location: 'Centro Comunitario La Floresta',
    registeredVoters: 275,
    status: 'pendiente',
  },
];
