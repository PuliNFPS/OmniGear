pub mod actions;
pub mod capabilities;
pub mod registry;

pub use actions::MouseActionId;

use crate::command::HidCommand;

pub trait MouseDriver {
    fn set_dpi(&self, dpi: u16) -> HidCommand;
    fn set_polling_rate(&self, rate: u16) -> HidCommand;
}
