import { IIncidentRepository } from '../../domain/repositories/IIncidentRepository';
import { CreateIncidentDTO, Incident } from '../../domain/entities/Incident';

export class CreateIncidentUseCase {
  constructor(private incidentRepository: IIncidentRepository) {}

  async execute(data: CreateIncidentDTO): Promise<Incident> {
    // Business Logic: Check if site exists, valid permissions is handled in middleware,
    // but maybe check if the user is allowed to create incidents for this specific site
    // or validate status transitions.
    
    if (!data.title) {
      throw new Error("Title is required");
    }

    return await this.incidentRepository.create(data);
  }
}