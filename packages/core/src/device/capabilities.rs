#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MouseCapabilities {
    pub dpi_range: Option<(u16, u16)>,
    pub polling_rates: Vec<u16>,
}

