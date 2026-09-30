//! O Leviathan V4: o que é fato deste aparelho, e não do protocolo RAWM.

mod apply;
mod description;
mod identity;
mod keys;
mod lod;
mod slot_settings;

pub use apply::apply_settings;
pub use description::{DpiAxes, DpiLimits, LeviathanV4Description, describe, onboard_slot_count};
pub use identity::{
    HidCollection, HidDevice, HidReport, LeviathanV4Usb, is_device_name, matches, usb,
};
pub use keys::{SHOW_POWER_KEY_ID, button_id, encode_show_power, key_id};
pub use lod::{NumericRange, lod_millimetres, lod_range};
pub use slot_settings::settings_from_slot;
