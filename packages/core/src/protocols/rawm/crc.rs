/// CRC16 do fabricante, como a biblioteca oficial o calcula.
///
/// Privado ao crate de propósito: quem precisa dele é o envelope, e expor a
/// rotina convidaria a uma segunda chamada fora dele. O valor de verificação
/// CCITT vive só no teste abaixo — não em `vectors/rawm-protocol.json`, que
/// nenhum dos dois lados conseguiria ler daqui (ver o comentário do teste).
pub(crate) fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xffff;
    for &value in data {
        crc = ((crc >> 8) & 0xff) | (crc << 8);
        crc ^= u16::from(value);
        crc ^= (crc & 0xff) >> 4;
        crc ^= crc << 12;
        crc ^= (crc & 0xff) << 5;
    }
    crc
}

#[cfg(test)]
mod tests {
    use super::*;

    /// O valor de verificação CCITT já viveu também em
    /// `vectors/rawm-protocol.json`, mas nenhum dos dois lados conseguia
    /// lê-lo de lá: `crc16` é `pub(crate)`, então `tests/vectors.rs` (um
    /// teste de integração, fora do crate) não alcança a função, e o
    /// TypeScript nunca teve acesso a ela. Um vetor que ninguém lê não é uma
    /// fonte compartilhada — por isso ele foi removido do arquivo, e esta
    /// asserção é a única casa do valor agora.
    #[test]
    fn matches_the_ccitt_check_value() {
        assert_eq!(crc16(b"123456789"), 0x29b1);
    }
}
