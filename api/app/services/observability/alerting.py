from __future__ import annotations

from app.config import get_settings
from app.logging_config import get_logger
from app.services.observability.metrics import SLO_TARGETS, tracker

logger = get_logger("alerting")

_fired_alerts: set[str] = set()


async def check_slos_and_alert() -> list[str]:
    """Check if any SLOs are breaching and trigger alerts if breaching > 5 minutes."""
    triggered = []
    settings = get_settings()

    for route in SLO_TARGETS:
        duration = tracker.get_breach_duration(route)
        # 5 minutes consecutive breach = 300 seconds
        if duration >= 300.0:
            alert_key = f"{route}_breached"
            triggered.append(route)

            if alert_key not in _fired_alerts:
                _fired_alerts.add(alert_key)
                logger.critical(
                    f"SLO BREACH ALERT: Route {route} has breached its SLO for {round(duration/60, 1)} minutes consecutively!",
                    extra={
                        "alert_type": "slo_breach",
                        "route": route,
                        "breach_duration_sec": duration,
                        "p99_latency_ms": (
                            tracker.get_p99(route)
                            if route != "websocket_signal"
                            else None
                        ),
                        "success_rate": (
                            tracker.get_websocket_success_rate()
                            if route == "websocket_signal"
                            else None
                        ),
                        "slo_target": SLO_TARGETS[route],
                    },
                )

                if settings.resend_api_key and settings.email_from_address:
                    try:
                        from app.services.email import send_email

                        p99_val = (
                            f"{tracker.get_p99(route)}ms"
                            if route != "websocket_signal"
                            else f"{round(tracker.get_websocket_success_rate() * 100, 1)}%"
                        )

                        await send_email(
                            to_address="operator@annealmusic.com",
                            subject=f"[AnnealMusic Alert] SLO Breach: {route}",
                            html_content=f"""
                            <h3>SLO Breach Alert</h3>
                            <p>Route: <b>{route}</b></p>
                            <p>Consecutive Breach Duration: {round(duration/60, 1)} minutes</p>
                            <p>Current Metrics: {p99_val}</p>
                            <p>SLO Target: {SLO_TARGETS[route]}</p>
                            """,
                        )
                    except Exception as e:
                        logger.error(f"Failed to deliver alert email: {e}")
        else:
            _fired_alerts.discard(f"{route}_breached")

    return triggered
