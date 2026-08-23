#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HidCommand {
    pub report_id: u8,
    pub data: Vec<u8>,
}

