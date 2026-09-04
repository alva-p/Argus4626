use anyhow::Result;
use std::{env, fs, path::PathBuf};
use substreams_ethereum::Abigen;

fn main() -> Result<()> {
    let abi = fs::read("abi/erc4626.json")?;
    let output = PathBuf::from(env::var("OUT_DIR")?).join("erc4626.rs");
    Abigen::from_bytes("Erc4626", &abi)?
        .generate()?
        .write_to_file(output)?;
    Ok(())
}
