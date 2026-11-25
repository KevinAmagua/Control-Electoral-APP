import { failure, ok, type Result } from '@/core/result/result';
import { queryWithLocalCache } from '@/data/local/sqliteClient';
import { supabase } from '@/data/remote/supabase/client';
import { POLITICAL_ORGANIZATIONS } from '@/domain/election/organization';
import type { Dignity } from '@/domain/election/dignity';

export type CandidateOption = {
  id: string;
  organizationId: string;
  organizationLabel: string;
  fullName: string;
  listNumber: number;
  dignidad: Dignity;
};

type CandidateRow = {
  id: string;
  organization_id: string;
  full_name: string;
  list_number: number;
};

function toOption(row: CandidateRow, dignidad: Dignity): CandidateOption {
  const organization = POLITICAL_ORGANIZATIONS.find(
    (item) => item.listNumber === row.list_number,
  );

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationLabel: organization?.shortName ?? `Lista ${row.list_number}`,
    fullName: row.full_name,
    listNumber: row.list_number,
    dignidad,
  };
}

export async function listCandidateOptions(
  dignidad: Dignity,
): Promise<Result<CandidateOption[]>> {
  return queryWithLocalCache(`candidates:${dignidad}`, async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, organization_id, full_name, list_number')
        .eq('dignidad', dignidad)
        .eq('active', true)
        .order('list_number', { ascending: true });

      if (error) {
        throw error;
      }

      return ok(((data ?? []) as unknown as CandidateRow[]).map((row) => toOption(row, dignidad)));
    } catch (error) {
      return failure(
        'ERROR_LISTAR_CANDIDATOS',
        error instanceof Error ? error.message : 'No fue posible cargar los candidatos',
      );
    }
  });
}

export async function listAllCandidateOptions(): Promise<Result<CandidateOption[]>> {
  const [alcaldia, prefectura] = await Promise.all([
    listCandidateOptions('alcaldia'),
    listCandidateOptions('prefectura'),
  ]);

  if (!alcaldia.ok) {
    return alcaldia;
  }
  if (!prefectura.ok) {
    return prefectura;
  }

  return ok([...alcaldia.value, ...prefectura.value]);
}
