from typing import Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int        # cantidad total de registros que matchean el filtro (no solo los de esta página)
    page: int
    page_size: int
    total_pages: int