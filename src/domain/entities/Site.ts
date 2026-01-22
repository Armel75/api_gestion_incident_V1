export interface SiteType {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface Site {
  id: string;
  name: string;
  typeId: string;
  type?: SiteType;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateSiteDTO = Pick<Site, 'name' | 'typeId'>;
export type CreateSiteTypeDTO = Pick<SiteType, 'name'>;