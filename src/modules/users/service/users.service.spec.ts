import { UsersService } from './users.service';

describe('UsersService', () => {
  const usersRepository = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
    findAndCount: jest.fn(),
  };
  const domainEventsService = {
    appendEvent: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation((callback: (manager: unknown) => unknown) =>
      callback({
        getRepository: jest.fn().mockReturnValue({
          save: jest.fn().mockImplementation(async (user) => user),
        }),
      }),
    );
    service = new UsersService(
      usersRepository as never,
      domainEventsService as never,
      dataSource as never,
    );
  });

  it('blocks user by toggling flag', async () => {
    usersRepository.findById.mockResolvedValue({ id: 'user-1', isBlocked: false });

    const result = await service.blockUser('user-1');

    expect(result.isBlocked).toBe(true);
  });

  it('unblocks user by toggling flag', async () => {
    usersRepository.findById.mockResolvedValue({ id: 'user-1', isBlocked: true });
    usersRepository.save.mockImplementation(async (user) => user);

    const result = await service.unblockUser('user-1');

    expect(result.isBlocked).toBe(false);
  });
});
