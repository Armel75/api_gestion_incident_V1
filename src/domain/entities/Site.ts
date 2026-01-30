export interface Site {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateSiteDTO = Pick<Site, 'name' | 'userId'>;

export interface SiteType {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateSiteTypeDTO = Pick<SiteType, 'name' | 'userId'>;