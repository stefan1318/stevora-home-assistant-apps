"""Graphical Home Assistant setup and configuration for STEVORA."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector
from .const import DOMAIN, CONF_LANGUAGE, DEFAULT_LANGUAGE
from .modules import CONF_PANEL_ENABLED, CONF_HOME_HUB_ENABLED

LANGUAGES = ("bg", "en")
CONF_DASHBOARD = "dashboard_path"
CONF_VOICE = "voice_enabled"
CONF_AUTO_DISCOVERY = "auto_discovery"
CONF_INCLUDE_UNASSIGNED = "include_unassigned"
CONF_ROOM_FILTER = "room_filter"
CONF_CLIMATE = "climate_entities"
CONF_LIGHTING = "lighting_entities"

class StevoraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id("stevora_home")
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="STEVORA Home", data=user_input)
        return self.async_show_form(step_id="user", data_schema=vol.Schema({
            vol.Required(CONF_LANGUAGE, default=DEFAULT_LANGUAGE): vol.In(LANGUAGES),
            vol.Required(CONF_AUTO_DISCOVERY, default=True): bool,
            vol.Required(CONF_INCLUDE_UNASSIGNED, default=False): bool,
            vol.Required(CONF_PANEL_ENABLED, default=True): bool,
            vol.Required(CONF_HOME_HUB_ENABLED, default=True): bool,
            vol.Required(CONF_VOICE, default=False): bool,
        }))

    @staticmethod
    def async_get_options_flow(config_entry):
        return StevoraOptionsFlow()

class StevoraOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        existing = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Required(CONF_LANGUAGE, default=existing.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)): vol.In(LANGUAGES),
            vol.Required(CONF_AUTO_DISCOVERY, default=existing.get(CONF_AUTO_DISCOVERY, True)): bool,
            vol.Required(CONF_INCLUDE_UNASSIGNED, default=existing.get(CONF_INCLUDE_UNASSIGNED, False)): bool,
            vol.Required(CONF_PANEL_ENABLED, default=existing.get(CONF_PANEL_ENABLED, True)): bool,
            vol.Required(CONF_HOME_HUB_ENABLED, default=existing.get(CONF_HOME_HUB_ENABLED, True)): bool,
            vol.Required(CONF_VOICE, default=existing.get(CONF_VOICE, False)): bool,
            vol.Optional(CONF_ROOM_FILTER, default=existing.get(CONF_ROOM_FILTER, [])): selector.AreaSelector(selector.AreaSelectorConfig(multiple=True)),
            vol.Optional(CONF_CLIMATE, default=existing.get(CONF_CLIMATE, [])): selector.EntitySelector(selector.EntitySelectorConfig(domain="climate", multiple=True)),
            vol.Optional(CONF_LIGHTING, default=existing.get(CONF_LIGHTING, [])): selector.EntitySelector(selector.EntitySelectorConfig(domain="light", multiple=True)),
        }))
