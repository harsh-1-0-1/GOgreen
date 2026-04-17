from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    db: str
    redis: str
    version: str
