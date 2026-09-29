pub mod actions;
pub mod capabilities;
pub mod registry;
pub mod settings;

pub use actions::MouseActionId;
pub use settings::{DpiStage, MouseParameters, MouseRPlusSettings, MouseSettings};

use crate::command::HidCommand;

pub trait MouseDriver {
    fn set_dpi(&self, dpi: u16) -> HidCommand;
    fn set_polling_rate(&self, rate: u16) -> HidCommand;
}
