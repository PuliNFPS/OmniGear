use crate::drivers::mock_mouse::MockMouseDriver;

pub enum RegisteredDriver {
    MockMouse(MockMouseDriver),
}

pub fn mock_registry() -> Vec<RegisteredDriver> {
    vec![RegisteredDriver::MockMouse(MockMouseDriver)]
}

