export type PoliticalOrganization = {
  id: string;
  name: string;
  shortName: string;
  listNumber: number;
  colors: {
    primary: string;
    secondary: string;
  };
};

export const ADN_ORGANIZATION: PoliticalOrganization = {
  id: 'adn',
  name: 'Acción Democrática Nacional',
  shortName: 'ADN',
  listNumber: 7,
  colors: {
    primary: '#6F2C91',
    secondary: '#EAE84B',
  },
};

export const POLITICAL_ORGANIZATIONS: readonly PoliticalOrganization[] = [
  ADN_ORGANIZATION,
  {
    id: 'creo',
    name: 'Creando Oportunidades',
    shortName: 'CREO',
    listNumber: 3,
    colors: { primary: '#005CA9', secondary: '#FFFFFF' },
  },
  {
    id: 'psc',
    name: 'Partido Social Cristiano',
    shortName: 'PSC',
    listNumber: 5,
    colors: { primary: '#0056A4', secondary: '#E10600' },
  },
  {
    id: 'unes',
    name: 'Unión Ecuatoriana',
    shortName: 'UNES',
    listNumber: 1,
    colors: { primary: '#C8102E', secondary: '#FFFFFF' },
  },
  {
    id: 'id',
    name: 'Izquierda Democrática',
    shortName: 'ID',
    listNumber: 2,
    colors: { primary: '#E30613', secondary: '#FFFFFF' },
  },
];

export const SELECTED_ORGANIZATION = ADN_ORGANIZATION;
