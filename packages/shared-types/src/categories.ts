export type CategoryKind = 'income' | 'expense';

export interface CategoryDto {
  id: string;
  userId: string | null;
  key: string;
  label: string;
  kind: CategoryKind;
}
