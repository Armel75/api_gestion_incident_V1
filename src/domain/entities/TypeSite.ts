export interface TypeSite {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateTypeSiteDTO = Pick<TypeSite, 'name'>;
export type UpdateTypeSiteDTO = Partial<Pick<TypeSite, 'name'>>;
