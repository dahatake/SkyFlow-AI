from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import HTTPException, Request

from .config import Settings


@dataclass
class User:
    id: str
    roles: set[str] = field(default_factory=set)
    name: str = ""


class Authenticator:
    """Entra ID bearer-token validation (issuer, audience, signature via tenant JWKS). Roles come from the `roles` claim."""

    def __init__(self, settings: Settings, signing_key_provider: Callable[[str], Any] | None = None):
        self.s = settings
        self._provider = signing_key_provider
        self._jwks = None

    @property
    def issuers(self) -> list[str]:
        t = self.s.tenant_id
        return [f"https://login.microsoftonline.com/{t}/v2.0", f"https://sts.windows.net/{t}/"]

    def _signing_key(self, token: str):
        if self._provider:
            return self._provider(token)
        if self._jwks is None:
            import jwt

            self._jwks = jwt.PyJWKClient(f"https://login.microsoftonline.com/{self.s.tenant_id}/discovery/v2.0/keys", cache_keys=True)
        return self._jwks.get_signing_key_from_jwt(token).key

    def validate(self, token: str) -> dict[str, Any]:
        import jwt

        key = self._signing_key(token)
        unverified_iss = jwt.decode(token, options={"verify_signature": False}).get("iss")
        if unverified_iss not in self.issuers:
            raise jwt.InvalidIssuerError("issuer not allowed")
        return jwt.decode(
            token, key, algorithms=["RS256"], audience=self.s.api_audience, issuer=unverified_iss,
            options={"require": ["exp", "iss", "aud"]},
        )

    async def __call__(self, request: Request) -> User:
        if self.s.auth_disabled:
            return User(id=request.headers.get("x-user-id", "anonymous")[:128])
        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            raise HTTPException(401, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"})
        try:
            claims = await asyncio.get_running_loop().run_in_executor(None, self.validate, header[7:].strip())
        except Exception as e:
            raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"}) from e
        roles = claims.get("roles") or []
        return User(
            id=str(claims.get("oid") or claims.get("sub") or "unknown"),
            roles=set(roles if isinstance(roles, list) else [roles]),
            name=str(claims.get("preferred_username") or claims.get("name") or ""),
        )
