import { CreateIncidentUseCase } from '../application/usecases/CreateIncidentUseCase';
import { IIncidentRepository } from '../domain/repositories/IIncidentRepository';
import { Incident } from '../domain/entities/Incident';
import { describe, it, expect, jest } from '@jest/globals';

// Mock Repository
const mockRepo: IIncidentRepository = {
  create: jest.fn() as any,
  findById: jest.fn() as any,
  findAll: jest.fn() as any,
  update: jest.fn() as any,
  delete: jest.fn() as any
};

describe('CreateIncidentUseCase', () => {
  it('should create an incident successfully', async () => {
    const useCase = new CreateIncidentUseCase(mockRepo);
    
    const input = {
      title: 'Server Down',
      description: 'Critical failure',
      reporterId: 'user-1',
      userId: 'user-1',
      siteId: 'site-1',
      subProcessId: 'proc-1',
      subCategoryId: 'cat-1'
    };

    const expectedResult = { id: 'inc-1', ...input, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() } as Incident;

    (mockRepo.create as any).mockResolvedValue(expectedResult);

    const result = await useCase.execute(input);

    expect(mockRepo.create).toHaveBeenCalledWith(input);
    expect(result.id).toBe('inc-1');
  });

  it('should throw error if title is missing', async () => {
    const useCase = new CreateIncidentUseCase(mockRepo);
    const input = {
        title: '',
        description: 'No title',
        reporterId: 'user-1',
        userId: 'user-1',
        siteId: 'site-1',
        subProcessId: 'proc-1',
        subCategoryId: 'cat-1'
      };
  
      await expect(useCase.execute(input)).rejects.toThrow('Title is required');
  });
});