from __future__ import annotations

import httpx
from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger("oauth")


class OAuthUserInfo:
    def __init__(self, subject: str, email: str, email_verified: bool, display_name: str | None = None) -> None:
        self.subject = subject
        self.email = email.strip().lower()
        self.email_verified = email_verified
        self.display_name = display_name


class OAuthService:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    def get_authorize_url(self, provider: str, state: str, redirect_uri: str) -> str:
        settings = get_settings()
        if provider == "google":
            if not settings.google_client_id:
                raise Exception("Google OAuth is not configured on the server.")
            return (
                f"https://accounts.google.com/o/oauth2/v2/auth"
                f"?response_type=code"
                f"&client_id={settings.google_client_id}"
                f"&redirect_uri={redirect_uri}"
                f"&scope=openid%20email%20profile"
                f"&state={state}"
            )
        elif provider == "github":
            if not settings.github_client_id:
                raise Exception("GitHub OAuth is not configured on the server.")
            return (
                f"https://github.com/login/oauth/authorize"
                f"?client_id={settings.github_client_id}"
                f"&redirect_uri={redirect_uri}"
                f"&scope=user:email"
                f"&state={state}"
            )
        else:
            raise ValueError(f"Unknown OAuth provider: {provider}")

    async def exchange_and_get_user(self, provider: str, code: str, redirect_uri: str) -> OAuthUserInfo:
        settings = get_settings()

        if provider == "google":
            # 1. Exchange code
            token_url = "https://oauth2.googleapis.com/token"
            payload = {
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            logger.info("Exchanging Google auth code for token")
            res = await self.client.post(token_url, data=payload)
            if res.status_code >= 400:
                logger.error(f"Google token exchange failed: {res.text}")
                raise Exception("Failed to exchange code with Google.")

            tokens = res.json()
            access_token = tokens.get("access_token")
            if not access_token:
                raise Exception("No access token returned from Google.")

            # 2. Get UserInfo
            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            res = await self.client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if res.status_code >= 400:
                logger.error(f"Google userinfo request failed: {res.text}")
                raise Exception("Failed to fetch user info from Google.")

            profile = res.json()
            sub = profile.get("sub")
            email = profile.get("email")
            email_verified = bool(profile.get("email_verified", False))
            name = profile.get("name")

            if not sub or not email:
                raise Exception("Google profile missing standard sub/email attributes.")

            return OAuthUserInfo(
                subject=sub,
                email=email,
                email_verified=email_verified,
                display_name=name,
            )

        elif provider == "github":
            # 1. Exchange code
            token_url = "https://github.com/login/oauth/access_token"
            payload = {
                "code": code,
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "redirect_uri": redirect_uri,
            }
            logger.info("Exchanging GitHub auth code for token")
            res = await self.client.post(
                token_url,
                json=payload,
                headers={"Accept": "application/json"},
            )
            if res.status_code >= 400:
                logger.error(f"GitHub token exchange failed: {res.text}")
                raise Exception("Failed to exchange code with GitHub.")

            tokens = res.json()
            access_token = tokens.get("access_token")
            if not access_token:
                raise Exception("No access token returned from GitHub.")

            # 2. Get Profile UserInfo
            profile_url = "https://api.github.com/user"
            headers = {
                "Authorization": f"token {access_token}",
                "User-Agent": "AnnealMusic-API",
                "Accept": "application/json",
            }
            res = await self.client.get(profile_url, headers=headers)
            if res.status_code >= 400:
                logger.error(f"GitHub user profile request failed: {res.text}")
                raise Exception("Failed to fetch user profile from GitHub.")

            profile = res.json()
            sub = str(profile.get("id"))
            name = profile.get("name") or profile.get("login")

            # 3. Fetch emails to get primary verified email
            emails_url = "https://api.github.com/user/emails"
            res = await self.client.get(emails_url, headers=headers)
            if res.status_code >= 400:
                logger.error(f"GitHub user emails request failed: {res.text}")
                raise Exception("Failed to fetch user emails from GitHub.")

            emails = res.json()
            primary_email = None
            email_verified = False

            # Try to find primary verified email, or first verified email, or first primary email
            for em in emails:
                if em.get("primary") and em.get("verified"):
                    primary_email = em.get("email")
                    email_verified = True
                    break
            if not primary_email:
                for em in emails:
                    if em.get("verified"):
                        primary_email = em.get("email")
                        email_verified = True
                        break
            if not primary_email and emails:
                primary_email = emails[0].get("email")
                email_verified = bool(emails[0].get("verified", False))

            if not sub or not primary_email:
                raise Exception("GitHub profile missing standard id/email attributes.")

            return OAuthUserInfo(
                subject=sub,
                email=primary_email,
                email_verified=email_verified,
                display_name=name,
            )

        else:
            raise ValueError(f"Unknown OAuth provider: {provider}")


_oauth_service: OAuthService | None = None


def get_oauth_service() -> OAuthService:
    global _oauth_service
    if _oauth_service is None:
        _oauth_service = OAuthService()
    return _oauth_service


def set_oauth_service(service: OAuthService) -> None:
    """Mock injector helper for OAuth exchange tests."""
    global _oauth_service
    _oauth_service = service
