export interface Site {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateSiteDTO = Pick<Site, 'name'>;

export interface SiteType {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateSiteTypeDTO = Pick<SiteType, 'name'>;