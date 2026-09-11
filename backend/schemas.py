from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str
    username: str


class SessionStartRequest(BaseModel):
    theme: str = Field(min_length=1)
    mentor: str = Field(min_length=1)


class ActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = ""
    priority: bool = False


class ActivityUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = ""
    priority: bool | None = None


class ActivityOut(BaseModel):
    id: int
    title: str
    notes: str
    date: str
    completed: bool
    time: str | None
    priority: bool = False

    model_config = {"from_attributes": True}
