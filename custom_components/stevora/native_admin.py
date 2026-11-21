"""Local gateway authorization probe. The gateway forwards the caller's Core bearer token."""
from aiohttp import web
from homeassistant.components.http import HomeAssistantView, require_admin


class NativeAdminView(HomeAssistantView):
    url = "/api/stevora/native/admin"
    name = "api:stevora:native:admin"
    requires_auth = True

    @require_admin
    async def get(self, request):
        return web.Response(status=204)
