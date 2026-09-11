from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))

    activities: Mapped[list["Activity"]] = relationship(back_populates="user")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user")
    quests: Mapped[list["Quest"]] = relationship(back_populates="user")
    badges: Mapped[list["Badge"]] = relationship(back_populates="user")
    progress: Mapped["UserProgress | None"] = relationship(back_populates="user", uselist=False)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    theme: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mentor: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="")
    date: Mapped[str] = mapped_column(String(10), index=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    time: Mapped[str | None] = mapped_column(String(32), nullable=True)
    priority: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="activities")


class UserProgress(Base):
    __tablename__ = "user_progress"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    theme: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mentor: Mapped[str | None] = mapped_column(String(64), nullable=True)
    streak_cached: Mapped[int] = mapped_column(Integer, default=0)
    mentor_event: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mentor_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="progress")


class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id"), nullable=True)
    quest_type: Mapped[str] = mapped_column(String(32), index=True)
    theme: Mapped[str] = mapped_column(String(32))
    title_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_at: Mapped[str] = mapped_column(String(32))
    completed_at: Mapped[str | None] = mapped_column(String(32), nullable=True)

    user: Mapped[User] = relationship(back_populates="quests")


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    badge_key: Mapped[str] = mapped_column(String(64))
    theme: Mapped[str] = mapped_column(String(32))
    earned_at: Mapped[str] = mapped_column(String(32))

    user: Mapped[User] = relationship(back_populates="badges")
