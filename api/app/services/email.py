from __future__ import annotations

import httpx
from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger("email")


class EmailClient:
    async def send_magic_link(self, email: str, link: str) -> None:
        raise NotImplementedError()


class ResendEmailClient(EmailClient):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        # We don't initialize AsyncClient inside __init__ because it needs to run inside an event loop,
        # and standard FastAPI/httpx practice recommends initializing it on-demand or in lifespan.
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(headers={"Authorization": f"Bearer {self.api_key}"})
        return self._client

    async def send_magic_link(self, email: str, link: str) -> None:
        url = "https://api.resend.com/emails"
        settings = get_settings()

        html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #0c0a09; color: #f5f5f4; padding: 40px; text-align: center;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #1c1917; border: 1px solid #44403c; border-radius: 16px; padding: 32px;">
    <h2 style="color: #fef3c7; font-family: monospace; letter-spacing: 0.1em; margin-bottom: 24px;">ANNEALMUSIC</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #a8a29e; margin-bottom: 32px;">
      Click the button below to log in or sign up. This magic link is valid for 15 minutes and can only be used once.
    </p>
    <a href="{link}" style="display: inline-block; background-color: #f59e0b; color: #0c0a09; font-weight: bold; font-family: monospace; letter-spacing: 0.1em; text-decoration: none; padding: 12px 28px; border-radius: 9999px; margin-bottom: 32px;">
      VERIFY EMAIL
    </a>
    <p style="font-size: 11px; color: #78716c; line-height: 1.5;">
      If you did not request this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>"""

        payload = {
            "from": settings.email_from_address,
            "to": [email],
            "subject": "AnnealMusic Magic Link",
            "html": html_content,
        }

        logger.info(f"Sending Resend magic link email to {email}")
        try:
            res = await self.client.post(url, json=payload)
            if res.status_code >= 400:
                logger.error(f"Failed to send email: {res.status_code} {res.text}")
                raise Exception(f"Failed to send email: {res.text}")
        except Exception as e:
            logger.exception("Resend HTTP request failed")
            raise e


class NoOpEmailClient(EmailClient):
    def __init__(self) -> None:
        self.sent_emails: list[tuple[str, str]] = []

    async def send_magic_link(self, email: str, link: str) -> None:
        logger.info(f"[NoOpEmailClient] Simulating Magic Link email to {email}: {link}")
        self.sent_emails.append((email, link))


_email_client: EmailClient | None = None


def get_email_client() -> EmailClient:
    global _email_client
    if _email_client is None:
        settings = get_settings()
        if settings.resend_api_key:
            _email_client = ResendEmailClient(settings.resend_api_key)
        else:
            _email_client = NoOpEmailClient()
    return _email_client


def set_email_client(client: EmailClient) -> None:
    """Helper to inject a custom email client for test mock assertions."""
    global _email_client
    _email_client = client
