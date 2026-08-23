use crate::{command::HidCommand, device::MouseDriver};

pub struct MockMouseDriver;

impl MouseDriver for MockMouseDriver {
    fn set_dpi(&self, dpi: u16) -> HidCommand {
        HidCommand {
            report_id: 1,
            data: dpi.to_le_bytes().to_vec(),
        }
    }

    fn set_polling_rate(&self, rate: u16) -> HidCommand {
        HidCommand {
            report_id: 2,
            data: rate.to_le_bytes().to_vec(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_dpi_little_endian() {
        let command = MockMouseDriver.set_dpi(1600);

        assert_eq!(command.report_id, 1);
        assert_eq!(command.data, vec![0x40, 0x06]);
    }

    #[test]
    fn encodes_polling_rate_little_endian() {
        let command = MockMouseDriver.set_polling_rate(1000);

        assert_eq!(command.report_id, 2);
        assert_eq!(command.data, vec![0xe8, 0x03]);
    }
}
