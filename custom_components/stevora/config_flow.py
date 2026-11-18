"""Config and options flows for STEVORA."""
import voluptuous as vol
from homeassistant import config_entries
from .const import DOMAIN, CONF_LANGUAGE, DEFAULT_LANGUAGE

LANGUAGES = ("bg", "en")

class StevoraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id("stevora_home")
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="STEVORA Home", data=user_input)
        return self.async_show_form(step_id="user", data_schema=vol.Schema({
            vol.Required(CONF_LANGUAGE, default=DEFAULT_LANGUAGE): vol.In(LANGUAGES),
        }))

    @staticmethod
    def async_get_options_flow(config_entry):
        return StevoraOptionsFlow()

class StevoraOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        language = self.config_entry.options.get(CONF_LANGUAGE, self.config_entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE))
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Required(CONF_LANGUAGE, default=language): vol.In(LANGUAGES),
        }))
