import { PaginationQueryDto } from '../dto/pagination-query.dto';

export const getPagination = (query: PaginationQueryDto) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};
