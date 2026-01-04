"""Basic auth + RBAC helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .config import get_settings


@dataclass(frozen=True)
class BasicUser:
    username: str
    password: str
    role: str


_security = HTTPBasic()


def _user_map() -> Dict[str, BasicUser]:
    settings = get_settings()
    users: Dict[str, BasicUser] = {}
    for entry in settings.basic_auth_users.split(","):
        if not entry.strip():
            continue
        try:
            username, password, role = entry.split(":", 2)
        except ValueError:
            continue
        users[username] = BasicUser(username=username, password=password, role=role)
    return users


def get_current_user(
    credentials: HTTPBasicCredentials = Depends(_security),
) -> BasicUser:
    users = _user_map()
    user = users.get(credentials.username)
    if not user or credentials.password != user.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth")
    return user


def require_roles(*roles: str):
    def _dependency(user: BasicUser = Depends(get_current_user)) -> BasicUser:
        if roles and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_role")
        return user

    return _dependency


OptionalRoleDependency = Optional[Iterable[str]]
